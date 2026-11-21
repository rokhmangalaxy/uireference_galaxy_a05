/**
 * Minimal 6502 assembler used only to build the legal smoke-test ROM.
 * Two passes, absolute-address based, no native dependencies.
 *
 * Supported syntax:
 *   label:
 *   LDA #$10            immediate
 *   LDA #<(label)       low byte of a label
 *   LDA #>(label)       high byte of a label
 *   LDA $2002           zero page / absolute (auto)
 *   LDA $2002,X  / ,Y   indexed
 *   LDA (ptr),Y         indirect indexed
 *   LDA (ptr,X)         indexed indirect
 *   JMP (ptr)           indirect
 *   BEQ label           relative branches
 *   .org .byte .word .res .align
 *   ; comments
 */

const OPS = {
  LDA: { imm: 0xa9, zp: 0xa5, zpx: 0xb5, abs: 0xad, absx: 0xbd, absy: 0xb9, indy: 0xb1, indx: 0xa1 },
  LDX: { imm: 0xa2, zp: 0xa6, zpy: 0xb6, abs: 0xae, absy: 0xbe },
  LDY: { imm: 0xa0, zp: 0xa4, zpx: 0xb4, abs: 0xac, absx: 0xbc },
  STA: { zp: 0x85, zpx: 0x95, abs: 0x8d, absx: 0x9d, absy: 0x99, indy: 0x91, indx: 0x81 },
  STX: { zp: 0x86, zpy: 0x96, abs: 0x8e },
  STY: { zp: 0x84, zpx: 0x94, abs: 0x8c },
  INC: { zp: 0xe6, zpx: 0xf6, abs: 0xee, absx: 0xfe },
  DEC: { zp: 0xc6, zpx: 0xd6, abs: 0xce, absx: 0xde },
  ADC: { imm: 0x69, zp: 0x65, abs: 0x6d },
  SBC: { imm: 0xe9, zp: 0xe5, abs: 0xed },
  AND: { imm: 0x29, zp: 0x25, abs: 0x2d },
  ORA: { imm: 0x09, zp: 0x05, abs: 0x0d },
  EOR: { imm: 0x49, zp: 0x45, abs: 0x4d },
  CMP: { imm: 0xc9, zp: 0xc5, abs: 0xcd },
  CPX: { imm: 0xe0, zp: 0xe4, abs: 0xec },
  CPY: { imm: 0xc0, zp: 0xc4, abs: 0xcc },
  BIT: { zp: 0x24, abs: 0x2c },
  JMP: { abs: 0x4c, ind: 0x6c },
  JSR: { abs: 0x20 },
  RTS: { imp: 0x60 },
  RTI: { imp: 0x40 },
  NOP: { imp: 0xea },
  INX: { imp: 0xe8 },
  INY: { imp: 0xc8 },
  DEX: { imp: 0xca },
  DEY: { imp: 0x88 },
  TAX: { imp: 0xaa },
  TAY: { imp: 0xa8 },
  TXA: { imp: 0x8a },
  TYA: { imp: 0x98 },
  TSX: { imp: 0xba },
  TXS: { imp: 0x9a },
  PHA: { imp: 0x48 },
  PLA: { imp: 0x68 },
  PHP: { imp: 0x08 },
  PLP: { imp: 0x28 },
  SEI: { imp: 0x78 },
  CLI: { imp: 0x58 },
  CLD: { imp: 0xd8 },
  CLC: { imp: 0x18 },
  SEC: { imp: 0x38 },
  BPL: { rel: 0x10 },
  BMI: { rel: 0x30 },
  BVC: { rel: 0x50 },
  BVS: { rel: 0x70 },
  BCC: { rel: 0x90 },
  BCS: { rel: 0xb0 },
  BNE: { rel: 0xd0 },
  BEQ: { rel: 0xf0 },
};

/** Split a directive argument list on top-level commas (quotes aware). */
function splitArgs(arg) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (const ch of arg) {
    if (ch === '"') quoted = !quoted;
    if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function evaluate(expr, symbols) {
  const str = expr.trim().match(/^"(.*)"$/);
  if (str) {
    if (str[1].length !== 1) throw new Error(`Only 1-char strings in expressions: ${expr}`);
    return str[1].charCodeAt(0);
  }
  const substituted = expr
    .replace(/\$([0-9A-Fa-f]+)/g, (_, h) => `(${parseInt(h, 16)})`)
    .replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (name) => {
      if (symbols[name] === undefined) throw new Error(`Undefined symbol: ${name}`);
      return `(${symbols[name]})`;
    })
    .replace(/(\d+)%/g, (_, b) => `(${parseInt(b, 2)})`);
  if (!/^[\d\s()+\-*/<>&|^~]+$/.test(substituted)) {
    throw new Error(`Cannot evaluate expression: ${expr}`);
  }
  // eslint-disable-next-line no-new-func
  const value = Function(`"use strict";return (${substituted});`)();
  if (!Number.isInteger(value)) throw new Error(`Non-integer: ${expr}`);
  return value;
}

function stripComments(src) {
  return src
    .split("\n")
    .map((l) => l.replace(/;.*$/, "").trim())
    .filter(Boolean);
}

function parseOperand(mnemonic, raw) {
  if (raw === "") return { mode: "imp", expr: null };
  if (raw.startsWith("#")) {
    let expr = raw.slice(1);
    let force = null;
    if (expr.startsWith("<")) {
      force = "lo";
      expr = expr.slice(1);
    } else if (expr.startsWith(">")) {
      force = "hi";
      expr = expr.slice(1);
    }
    return { mode: "imm", expr, force };
  }
  if (/^\([^)]*,\s*[xX]\)$/.test(raw)) {
    return { mode: "indx", expr: raw.slice(1, raw.lastIndexOf(",")) };
  }
  if (/^\([^)]*\)\s*,\s*[yY]$/.test(raw)) {
    return { mode: "indy", expr: raw.replace(/\)\s*,\s*[yY]$/, "").slice(1) };
  }
  if (/^\(.*\)$/.test(raw)) return { mode: "ind", expr: raw.slice(1, -1) };
  const mx = raw.match(/^(.*),\s*[xX]$/);
  if (mx) return { mode: "absx", expr: mx[1] };
  const my = raw.match(/^(.*),\s*[yY]$/);
  if (my) return { mode: "absy", expr: my[1] };
  // Branch targets look like ordinary absolute operands; the encoder turns
  // them into a relative form because the opcode table only has `rel`.
  if (OPS[mnemonic] && OPS[mnemonic].rel !== undefined) return { mode: "rel", expr: raw };
  return { mode: "abs", expr: raw };
}

function sizeFor(mnemonic, mode, value) {
  const table = OPS[mnemonic];
  if (!table) throw new Error(`Unknown mnemonic: ${mnemonic}`);
  if (mode === "imp") return 1;
  if (mode === "rel") return 2;
  if (mode === "imm") return 2;
  if (mode === "abs") {
    // zero-page when the address is small and the opcode supports it
    if (value !== null && value >= 0 && value < 0x100 && table.zp !== undefined) return 2;
    return 3;
  }
  if (mode === "absx" && value !== null && value >= 0 && value < 0x100 && table.zpx !== undefined) return 2;
  if (mode === "absy" && value !== null && value >= 0 && value < 0x100 && table.zpy !== undefined) return 2;
  if (mode === "indx" || mode === "indy") return 2;
  return 3;
}

function encode(mnemonic, mode, value, pc, symbols, lineNo) {
  const table = OPS[mnemonic];
  const fail = (m) => {
    throw new Error(`Line ${lineNo}: ${m}`);
  };
  let m = mode;
  let opcode = null;
  let operandSize = 0;

  if (m === "imp" || m === "rel") {
    opcode = table[m];
    operandSize = m === "rel" ? 1 : 0;
  } else if (m === "imm") {
    opcode = table.imm;
    operandSize = 1;
  } else {
    // resolve zero-page forms
    if ((m === "abs" || m === "absx" || m === "absy") && value < 0x100) {
      const zpMode = m === "abs" ? "zp" : m === "absx" ? "zpx" : "zpy";
      if (table[zpMode] !== undefined) m = zpMode;
    }
    if (m === "zp" || m === "zpx" || m === "zpy" || m === "indx" || m === "indy") {
      opcode = table[m];
      operandSize = 1;
    } else {
      opcode = table[m];
      operandSize = 2;
    }
  }
  if (opcode === undefined || opcode === null) fail(`Unsupported ${mnemonic} mode ${mode}`);

  const bytes = [opcode];
  if (m === "rel") {
    const target = value;
    const delta = target - (pc + 2);
    if (delta < -128 || delta > 127) fail(`Branch out of range (${delta})`);
    bytes.push(delta & 0xff);
  } else if (operandSize === 1) {
    bytes.push(value & 0xff);
  } else if (operandSize === 2) {
    bytes.push(value & 0xff, (value >> 8) & 0xff);
    void symbols;
  }
  return bytes;
}

/**
 * Assemble `source`. Returns { bytes: Uint8Array, symbols }.
 * `org` defaults to $8000. Bytes returned cover [org, highestWritten].
 */
export function assemble(source, { org = 0x8000, symbols: initial = {} } = {}) {
  const lines = stripComments(source);
  const symbols = { ...initial };
  // .org is absolute, so org-relative offsets must not be flushed back to the
  // start of the image. Keep the lowest .org seen as the image base instead.
  let imageBase = org;
  const relocate = (addr) => {
    imageBase = Math.min(imageBase, addr);
  };
  const image = new Uint8Array(0x10000);
  const written = new Uint8Array(0x10000);
  let pc = org;
  let maxAddress = org;

  for (let pass = 1; pass <= 2; pass++) {
    pc = org;
    symbols.__pass = pass;
    const pending = [];
    for (let li = 0; li < lines.length; li++) {
      const lineNo = li + 1;
      let line = lines[li];
      const labelMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
      if (labelMatch) {
        if (pass === 1) symbols[labelMatch[1]] = pc;
        else if (symbols[labelMatch[1]] !== pc) {
          throw new Error(`Line ${lineNo}: label moved between passes (${labelMatch[1]})`);
        }
        line = labelMatch[2].trim();
        if (!line) continue;
      }
      if (line.startsWith(".")) {
        const [dir, ...rest] = line.split(/\s+/);
        const arg = rest.join(" ").trim();
        if (dir === ".org") {
          pc = evaluate(arg, symbols) & 0xffff;
          relocate(pc);
        } else if (dir === ".byte") {
          for (const part of splitArgs(arg)) {
            const str = part.trim().match(/^"(.*)"$/);
            const vals = str
              ? Array.from(str[1]).map((c) => c.charCodeAt(0))
              : [evaluate(part, symbols)];
            for (const v of vals) {
              if (pass === 2) {
                image[pc] = v & 0xff;
                written[pc] = 1;
              }
              pc = Math.min(pc + 1, 0x10000);
            }
          }
        } else if (dir === ".word") {
          for (const part of splitArgs(arg)) {
            const v = evaluate(part, symbols);
            if (pass === 2) {
              image[pc] = v & 0xff;
              image[pc + 1] = (v >> 8) & 0xff;
              written[pc] = written[pc + 1] = 1;
            }
            pc = Math.min(pc + 2, 0x10000);
          }
        } else if (dir === ".res") {
          const n = evaluate(arg, symbols);
          if (pass === 1) {
            // Sizing pass: advance without emitting or writing.
            pc = Math.min(pc + n, 0x10000);
          } else {
            written.fill(1, pc, Math.min(pc + n, 0x10000));
            pc = Math.min(pc + n, 0x10000);
          }
        } else {
          throw new Error(`Line ${lineNo}: unknown directive ${dir}`);
        }
        maxAddress = Math.max(maxAddress, pc);
        continue;
      }
      const m = line.match(/^([A-Z]{3})\s*(.*)$/);
      if (!m) throw new Error(`Line ${lineNo}: cannot parse "${line}"`);
      const [, mnemonic, raw] = m;
      const { mode, expr, force } = parseOperand(mnemonic, raw.replace(/\s+/g, ""));
      let value = 0;
      if (expr !== null) {
        try {
          value = evaluate(expr, symbols);
        } catch (e) {
          if (pass === 1) {
            pending.push({ lineNo, expr });
            value = 0x8000; // assume 16-bit for sizing of forward refs
          } else {
            throw e;
          }
        }
        if (force === "lo") value = value & 0xff;
        if (force === "hi") value = (value >> 8) & 0xff;
      }
      if (pass === 1) {
        pc = (pc + sizeFor(mnemonic, mode, value)) & 0xffff;
      } else {
        const bytes = encode(mnemonic, mode, value, pc, symbols, lineNo);
        for (const b of bytes) {
          image[pc] = b;
          written[pc] = 1;
          pc = Math.min(pc + 1, 0x10000);
        }
      }
      maxAddress = Math.max(maxAddress, pc);
    }
    void pending;
  }

  return { bytes: image.slice(imageBase, maxAddress), symbols, imageBase };
}
