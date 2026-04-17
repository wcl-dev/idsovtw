#!/usr/bin/env node
/**
 * 資料驗證腳本
 * - 資料來源 YAML（source.schema.json）
 * - 治理落差矩陣（governance.schema.json）
 *
 * 檢查項目：
 * - JSON Schema 驗證（ajv）
 * - 往返測試（parse → dump → parse 結果相等）
 * - 證據引用交叉稽核（evidence_refs 指向的行範圍存在且非空）
 * - 證據紀律（partial/implemented 必須有 evidence_refs）
 *
 * 使用：node scripts/validate.mjs
 * 退出碼：0 全通過／1 有任一失敗
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SCHEMA_DIR = join(ROOT, "schema");
const SOURCES_DIR = join(ROOT, "data", "sources");
const MATRIX_PATH = join(ROOT, "data", "governance-matrix.yaml");
const ACCESS_PATH = join(ROOT, "data", "access-tiers.yaml");

const ansi = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function loadSchema(name) {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, name), "utf8"));
}

function loadYaml(path) {
  const raw = readFileSync(path, "utf8");
  return { raw, parsed: yaml.load(raw) };
}

/**
 * 往返測試：parse → dump → parse 結果應相等
 */
function roundTripEqual(parsed) {
  const dumped = yaml.dump(parsed, { noRefs: true, lineWidth: -1 });
  const reparsed = yaml.load(dumped);
  return JSON.stringify(reparsed) === JSON.stringify(parsed);
}

/**
 * 解析 file:L{start}-L{end} 格式的證據引用
 * 支援路徑含斜線（如 data/sources/cip.yaml:L80-L89）
 */
function verifyEvidenceRef(ref) {
  const m = ref.match(/^([\w./-]+):L(\d+)-L(\d+)$/);
  if (!m) return { ok: false, reason: "格式不符 file:L{n}-L{n}" };
  const [, file, startStr, endStr] = m;
  const start = Number(startStr);
  const end = Number(endStr);
  if (start > end) return { ok: false, reason: `起始行 ${start} > 結束行 ${end}` };

  const filePath = join(ROOT, file);
  if (!existsSync(filePath))
    return { ok: false, reason: `找不到檔案 ${file}` };

  const lines = readFileSync(filePath, "utf8").split("\n");
  if (end > lines.length)
    return {
      ok: false,
      reason: `結束行 ${end} 超過檔案總行數 ${lines.length}`,
    };

  const slice = lines.slice(start - 1, end);
  const hasContent = slice.some((l) => l.trim().length > 0);
  if (!hasContent)
    return { ok: false, reason: `行範圍 L${start}-L${end} 全為空白` };

  return { ok: true };
}

/**
 * 資料來源 YAML 的證據紀律檢查
 */
function checkSourceEvidenceDiscipline(sourceData) {
  const issues = [];
  const status = sourceData.audit?.verification_status;
  const refs = sourceData.audit?.evidence_refs || [];

  if ((status === "verified" || status === "partial") && refs.length === 0) {
    issues.push(
      `verification_status=${status} 但 evidence_refs 為空——verified/partial 必須附證據引用`
    );
  }

  return issues;
}

/**
 * 治理矩陣的證據紀律與覆蓋率檢查
 */
function checkGovernanceMatrix(matrix) {
  const issues = [];
  const stats = { none: 0, partial: 0, implemented: 0 };
  const scoreDetails = [];

  const expectedSources = ["cip", "data-gov-tw", "ticd", "ailt", "tcmb", "openmuseum"];
  const expectedDims = {
    CARE: ["collective_benefit", "authority_to_control", "responsibility", "ethics"],
    OCAP: ["ownership", "control", "access", "possession"],
    TK_Labels: ["provenance", "protocol", "permission"],
    localized: [
      "consultation_consent",
      "traditional_knowledge_protection",
      "rights_respect_clause",
    ],
  };
  const totalExpectedCells = 6 * (4 + 4 + 3 + 3); // = 84

  let cellsSeen = 0;

  for (const sourceId of expectedSources) {
    const src = matrix.sources?.[sourceId];
    if (!src) {
      issues.push(`矩陣缺少 source: ${sourceId}`);
      continue;
    }

    // checked_documents 必存在
    if (!src.checked_documents || src.checked_documents.length === 0) {
      issues.push(`${sourceId}: checked_documents 為空`);
    } else {
      // 驗證引用的檔案存在（允許純檔案路徑或含行範圍）
      for (const doc of src.checked_documents) {
        if (doc.includes(":L")) {
          const { ok, reason } = verifyEvidenceRef(doc);
          if (!ok)
            issues.push(
              `${sourceId}.checked_documents 無效 [${doc}]: ${reason}`
            );
        } else {
          const docPath = join(ROOT, doc);
          if (!existsSync(docPath))
            issues.push(
              `${sourceId}.checked_documents 找不到檔案 [${doc}]`
            );
        }
      }
    }

    // 逐框架逐維度檢查
    for (const [framework, dims] of Object.entries(expectedDims)) {
      for (const dim of dims) {
        const cell = src.scores?.[framework]?.[dim];
        if (!cell) {
          issues.push(`${sourceId}.${framework}.${dim} 缺失`);
          continue;
        }
        cellsSeen++;
        const score = cell.score;
        if (!["none", "partial", "implemented"].includes(score)) {
          issues.push(
            `${sourceId}.${framework}.${dim} score 值非法: ${score}`
          );
          continue;
        }
        stats[score]++;
        scoreDetails.push({ source: sourceId, framework, dim, score });

        // 證據紀律：partial/implemented 必須有 rationale 與 evidence_refs
        if (score !== "none") {
          if (!cell.rationale) {
            issues.push(
              `${sourceId}.${framework}.${dim} score=${score} 但無 rationale`
            );
          }
          if (!cell.evidence_refs || cell.evidence_refs.length === 0) {
            issues.push(
              `${sourceId}.${framework}.${dim} score=${score} 但 evidence_refs 為空——partial/implemented 必須附證據`
            );
          } else {
            for (const ref of cell.evidence_refs) {
              const { ok, reason } = verifyEvidenceRef(ref);
              if (!ok)
                issues.push(
                  `${sourceId}.${framework}.${dim} evidence_ref 無效 [${ref}]: ${reason}`
                );
            }
          }
        }

        // 非 none 但 rationale 過短
        if (score !== "none" && cell.rationale && cell.rationale.length < 10) {
          issues.push(
            `${sourceId}.${framework}.${dim} rationale 過短（少於 10 字），無法支持 ${score} 評分`
          );
        }
      }
    }
  }

  // 覆蓋率檢查
  if (cellsSeen !== totalExpectedCells) {
    issues.push(
      `格數不符：實際 ${cellsSeen} 格，應為 ${totalExpectedCells} 格`
    );
  }

  return { issues, stats, cellsSeen, scoreDetails };
}

/**
 * 存取性分層矩陣檢查
 */
function checkAccessTiers(access) {
  const issues = [];
  const dimensions = [
    "discoverability",
    "technical_barrier",
    "authorization_barrier",
    "license_clarity",
    "institutional_stability",
    "reusability",
  ];
  const expectedSources = ["cip", "data-gov-tw", "ticd", "ailt", "tcmb", "openmuseum"];
  const totalExpectedCells = expectedSources.length * dimensions.length;

  let cellsSeen = 0;
  const totalsBySource = {};
  const scoreDistribution = { 0: 0, 1: 0, 2: 0, 3: 0 };

  for (const sourceId of expectedSources) {
    const src = access.sources?.[sourceId];
    if (!src) {
      issues.push(`存取性矩陣缺少 source: ${sourceId}`);
      continue;
    }

    let sourceTotal = 0;
    for (const dim of dimensions) {
      const cell = src[dim];
      if (!cell) {
        issues.push(`${sourceId}.${dim} 缺失`);
        continue;
      }
      cellsSeen++;

      if (typeof cell.score !== "number" || cell.score < 0 || cell.score > 3) {
        issues.push(
          `${sourceId}.${dim} score 值非法: ${cell.score}（應為 0-3 整數）`
        );
        continue;
      }
      sourceTotal += cell.score;
      scoreDistribution[cell.score]++;

      if (!cell.rationale || cell.rationale.length < 10) {
        issues.push(
          `${sourceId}.${dim} rationale 缺失或過短（少於 10 字）`
        );
      }

      if (!cell.evidence_refs || cell.evidence_refs.length === 0) {
        issues.push(`${sourceId}.${dim} evidence_refs 為空`);
      } else {
        for (const ref of cell.evidence_refs) {
          const { ok, reason } = verifyEvidenceRef(ref);
          if (!ok)
            issues.push(
              `${sourceId}.${dim} evidence_ref 無效 [${ref}]: ${reason}`
            );
        }
      }
    }
    totalsBySource[sourceId] = sourceTotal;
  }

  if (cellsSeen !== totalExpectedCells) {
    issues.push(
      `存取性格數不符：實際 ${cellsSeen} 格，應為 ${totalExpectedCells} 格`
    );
  }

  return { issues, cellsSeen, totalsBySource, scoreDistribution };
}

// ── 主程式 ──

async function main() {
  console.log(ansi.dim(`Schema 目錄:    ${SCHEMA_DIR}`));
  console.log(ansi.dim(`資料來源目錄:   ${SOURCES_DIR}`));
  console.log(ansi.dim(`治理矩陣:       ${MATRIX_PATH}`));
  console.log();

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const sourceSchema = loadSchema("source.schema.json");
  const validateSource = ajv.compile(sourceSchema);

  const governanceSchema = existsSync(join(SCHEMA_DIR, "governance.schema.json"))
    ? loadSchema("governance.schema.json")
    : null;
  const validateGovernance = governanceSchema
    ? ajv.compile(governanceSchema)
    : null;

  let totalFailures = 0;

  // ── 驗證資料來源 YAML ──
  console.log(ansi.bold("── 資料來源 YAML ──"));

  const sourceFiles = readdirSync(SOURCES_DIR).filter((f) =>
    f.endsWith(".yaml")
  );
  if (sourceFiles.length === 0) {
    console.log(ansi.yellow("⚠ data/sources/ 內沒有 YAML 檔"));
    process.exit(1);
  }

  const sourceResults = [];
  for (const file of sourceFiles) {
    const filePath = join(SOURCES_DIR, file);
    const failures = [];

    let parsed;
    try {
      parsed = loadYaml(filePath).parsed;
    } catch (err) {
      failures.push(`YAML 解析失敗: ${err.message}`);
      sourceResults.push({ file, failures });
      totalFailures += failures.length;
      continue;
    }

    if (!validateSource(parsed)) {
      for (const err of validateSource.errors) {
        failures.push(
          `Schema 錯誤 ${err.instancePath || "/"}: ${err.message}` +
            (err.params ? ` (${JSON.stringify(err.params)})` : "")
        );
      }
    }

    if (!roundTripEqual(parsed)) {
      failures.push(
        "往返測試失敗：parse → dump → parse 結果不相等"
      );
    }

    for (const issue of checkSourceEvidenceDiscipline(parsed)) {
      failures.push(`證據紀律: ${issue}`);
    }

    const refs = parsed.audit?.evidence_refs || [];
    for (const ref of refs) {
      const { ok, reason } = verifyEvidenceRef(ref);
      if (!ok) failures.push(`evidence_ref 無效 [${ref}]: ${reason}`);
    }

    if (parsed.audit?.inventory_ref) {
      const { ok, reason } = verifyEvidenceRef(parsed.audit.inventory_ref);
      if (!ok)
        failures.push(
          `inventory_ref 無效 [${parsed.audit.inventory_ref}]: ${reason}`
        );
    }

    sourceResults.push({ file, failures });
    totalFailures += failures.length;
  }

  for (const { file, failures } of sourceResults) {
    if (failures.length === 0) {
      console.log(`${ansi.green("✓")} ${file}`);
    } else {
      console.log(`${ansi.red("✗")} ${file}`);
      for (const f of failures) console.log(`  ${ansi.red("·")} ${f}`);
    }
  }

  // ── 驗證治理矩陣 ──
  if (validateGovernance && existsSync(MATRIX_PATH)) {
    console.log();
    console.log(ansi.bold("── 治理落差矩陣 ──"));

    const matrixFailures = [];
    let matrix;
    try {
      matrix = loadYaml(MATRIX_PATH).parsed;
    } catch (err) {
      matrixFailures.push(`YAML 解析失敗: ${err.message}`);
    }

    if (matrix) {
      if (!validateGovernance(matrix)) {
        for (const err of validateGovernance.errors) {
          matrixFailures.push(
            `Schema 錯誤 ${err.instancePath || "/"}: ${err.message}` +
              (err.params ? ` (${JSON.stringify(err.params)})` : "")
          );
        }
      }

      if (!roundTripEqual(matrix)) {
        matrixFailures.push("往返測試失敗");
      }

      const { issues, stats, cellsSeen } = checkGovernanceMatrix(matrix);
      for (const issue of issues) matrixFailures.push(issue);

      if (matrixFailures.length === 0) {
        console.log(`${ansi.green("✓")} governance-matrix.yaml`);
        console.log(
          `  ${ansi.dim("格數:")} ${cellsSeen}／84  ` +
            `${ansi.dim("分布:")} ` +
            `implemented ${ansi.bold(stats.implemented)}  ` +
            `partial ${ansi.bold(stats.partial)}  ` +
            `none ${ansi.bold(stats.none)}`
        );
      } else {
        console.log(`${ansi.red("✗")} governance-matrix.yaml`);
        for (const f of matrixFailures) console.log(`  ${ansi.red("·")} ${f}`);
      }
    }

    totalFailures += matrixFailures.length;
  }

  // ── 驗證存取性分層 ──
  const accessSchemaPath = join(SCHEMA_DIR, "access.schema.json");
  if (existsSync(accessSchemaPath) && existsSync(ACCESS_PATH)) {
    console.log();
    console.log(ansi.bold("── 存取性分層矩陣 ──"));

    const accessSchema = loadSchema("access.schema.json");
    const validateAccess = ajv.compile(accessSchema);
    const accessFailures = [];
    let access;
    try {
      access = loadYaml(ACCESS_PATH).parsed;
    } catch (err) {
      accessFailures.push(`YAML 解析失敗: ${err.message}`);
    }

    if (access) {
      if (!validateAccess(access)) {
        for (const err of validateAccess.errors) {
          accessFailures.push(
            `Schema 錯誤 ${err.instancePath || "/"}: ${err.message}` +
              (err.params ? ` (${JSON.stringify(err.params)})` : "")
          );
        }
      }

      if (!roundTripEqual(access)) {
        accessFailures.push("往返測試失敗");
      }

      const { issues, cellsSeen, totalsBySource, scoreDistribution } =
        checkAccessTiers(access);
      for (const issue of issues) accessFailures.push(issue);

      if (accessFailures.length === 0) {
        console.log(`${ansi.green("✓")} access-tiers.yaml`);
        console.log(
          `  ${ansi.dim("格數:")} ${cellsSeen}／36  ` +
            `${ansi.dim("分數分布:")} ` +
            `0分 ${ansi.bold(scoreDistribution[0])}  ` +
            `1分 ${ansi.bold(scoreDistribution[1])}  ` +
            `2分 ${ansi.bold(scoreDistribution[2])}  ` +
            `3分 ${ansi.bold(scoreDistribution[3])}`
        );
        console.log(`  ${ansi.dim("總分 (/18):")}`);
        for (const [src, total] of Object.entries(totalsBySource)) {
          console.log(`    ${src.padEnd(14)} ${ansi.bold(total)}`);
        }
      } else {
        console.log(`${ansi.red("✗")} access-tiers.yaml`);
        for (const f of accessFailures) console.log(`  ${ansi.red("·")} ${f}`);
      }
    }

    totalFailures += accessFailures.length;
  }

  console.log();
  console.log(`總計 ${totalFailures} 項問題。`);
  process.exit(totalFailures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(ansi.red("執行失敗："), err);
  process.exit(1);
});
