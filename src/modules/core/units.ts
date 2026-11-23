/** Length helpers. The design model stores whole inches; the UI edits feet + inches. */
export function toInches(feet: number, inches = 0): number {
  return Math.round(feet * 12 + inches);
}
export function splitFeetInches(totalInches: number): { feet: number; inches: number } {
  const sign = totalInches < 0 ? -1 : 1;
  const abs = Math.abs(Math.round(totalInches));
  return { feet: sign * Math.floor(abs / 12), inches: abs % 12 };
}
export function formatFeetInches(totalInches: number): string {
  const { feet, inches } = splitFeetInches(totalInches);
  if (inches === 0) return `${feet}'`;
  if (feet === 0) return `${inches}"`;
  return `${feet}' ${inches}"`;
}
export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
