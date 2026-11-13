// Links each college of a duty session to its account college (the
// `colleges` table). The link decides which college admin can see the
// published duties and gives the full college name used in letters.
//
// Account college codes sometimes carry an old code in brackets, e.g.
// "AAKMS (CCCA)" or "KDPICA (UCCA)": both codes are tried.

import { collegeKey } from './names';

export interface MasterCollege {
  id: string;
  code: string;
  name: string;
}

/** Every key an account college answers to: its code and any bracketed code. */
export function masterKeys(code: string): string[] {
  const keys = new Set<string>();
  const main = code.replace(/\(.*?\)/g, ' ').trim();
  if (main) keys.add(collegeKey(main));
  for (const m of code.matchAll(/\(([^)]*)\)/g)) {
    const inner = m[1].trim();
    // Only code-like text ("CCCA"), not places ("Gandhinagar").
    if (inner && !/\s/.test(inner) && inner === inner.toUpperCase()) keys.add(collegeKey(inner));
  }
  keys.delete('');
  return [...keys];
}

/** True when one code is the start of the other (KHYATI / KHYATIBCA), both 4+ letters. */
export function isCodePrefix(a: string, b: string): boolean {
  return Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a));
}

/**
 * The account college for a duty college code, or null when there is no
 * match or more than one (the chairperson then picks by hand). Tries the
 * code and bracketed old codes first ("CCCA" -> "AAKMS (CCCA)"), then a
 * code that is the start of the other ("KHYATI" -> "KHYATIBCA").
 */
export function matchMasterCollege(
  dutyCode: string,
  colleges: readonly MasterCollege[],
  otherCodes: readonly string[] = [],
): MasterCollege | null {
  const own = [dutyCode, ...otherCodes].map(collegeKey).filter(Boolean);
  if (!own.length) return null;
  const only = (hits: MasterCollege[]) => (new Set(hits.map((c) => c.id)).size === 1 ? hits[0] : null);
  const exact = colleges.filter((c) => masterKeys(c.code).some((k) => own.includes(k)));
  if (exact.length) return only(exact);
  return only(colleges.filter((c) => masterKeys(c.code).some((k) => own.some((o) => isCodePrefix(k, o)))));
}

/** Parse what the chairperson typed ("CCCA, UCCA") into clean codes. */
export function parseOtherCodes(text: string): string[] {
  return [...new Set(text.split(/[,;/\s]+/).map(collegeKey).filter(Boolean))];
}

/**
 * Every code a duty college answers to: its own code, the other codes the
 * chairperson typed, and the codes of its account college. "AAKMS" also answers to "CCCA" when the account is
 * "AAKMS (CCCA)".
 */
export function collegeAliases(
  dutyCode: string,
  colleges: readonly MasterCollege[],
  otherCodes: readonly string[] = [],
): string[] {
  const keys = new Set([dutyCode, ...otherCodes].map(collegeKey));
  const m = matchMasterCollege(dutyCode, colleges, otherCodes);
  if (m) for (const k of masterKeys(m.code)) keys.add(k);
  keys.delete('');
  return [...keys];
}
