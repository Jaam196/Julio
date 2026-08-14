import { isValidTicketNumber } from './ticketUtils';
import { scoreOcrCandidates } from './ticketCandidateScorer';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('--- RUNNING TICKET OCR TESTS ---');

// 1. Validation tests
assert(isValidTicketNumber('657') === true, '"657" should be valid');
assert(isValidTicketNumber('329') === true, '"329" should be valid');
assert(isValidTicketNumber('579') === true, '"579" should be valid');
assert(isValidTicketNumber('179') === true, '"179" should be valid');

assert(isValidTicketNumber('65') === false, '"65" should be invalid');
assert(isValidTicketNumber('6579') === false, '"6579" should be invalid');
assert(isValidTicketNumber('5057') === false, '"5057" should be invalid');
assert(isValidTicketNumber('2026') === false, '"2026" should be invalid');
assert(isValidTicketNumber('14') === false, '"14" should be invalid');
assert(isValidTicketNumber('16,45') === false, '"16,45" should be invalid');
assert(isValidTicketNumber('14:41') === false, '"14:41" should be invalid');

// 2. Sample 1 Extraction Test
const sample1 = `
T001006/5057
In Local
657
En el local
COCINA
1 GOURMET FRITES CHILI CHEESE
`;

const candidates1 = scoreOcrCandidates(sample1, []);
const accepted1 = candidates1.find((c) => c.accepted);
assert(accepted1?.candidate === '657', `Sample 1 should extract 657, got: ${accepted1?.candidate}`);

// Ensure false candidates like 057, 505, 5057 are rejected
const falseFromSample1 = candidates1.filter((c) => ['057', '505', '5057', '1006'].includes(c.candidate));
falseFromSample1.forEach((fc) => {
  assert(fc.accepted === false, `False candidate ${fc.candidate} must be rejected`);
});

// 3. Sample 2 Extraction Test
const sample2 = `
T001003-8329
TOTAL 16,45 €
329
`;

const candidates2 = scoreOcrCandidates(sample2, []);
const accepted2 = candidates2.find((c) => c.accepted);
assert(accepted2?.candidate === '329', `Sample 2 should extract 329, got: ${accepted2?.candidate}`);

// 4. Sample 3 Extraction Test
const sample3 = `
T001005-5479
TOTAL 16,00 €
579
`;

const candidates3 = scoreOcrCandidates(sample3, []);
const accepted3 = candidates3.find((c) => c.accepted);
assert(accepted3?.candidate === '579', `Sample 3 should extract 579, got: ${accepted3?.candidate}`);

// 5. Sample 4 Extraction Test
const sample4 = `
T001001-16179
TOTAL 13,95 €
179
`;

const candidates4 = scoreOcrCandidates(sample4, []);
const accepted4 = candidates4.find((c) => c.accepted);
assert(accepted4?.candidate === '179', `Sample 4 should extract 179, got: ${accepted4?.candidate}`);

// 6. Test Rejection of Date, Time, Price, Tax, and Long Reference Codes
const forbiddenCandidates = [
  '100', '006', '505', '057', '829', '161', '202', '026', '014', '141', '425', '164', '139', '105'
];

const noisySample = `
FECHA: 13/08/2026 14:41:25
SUBTOTAL: 15,00 €
IVA 10%: 1,45 €
TOTAL: 16,45 €
T001006/5057
T001003-8329
T001005-5479
T001001-16179
TOTAL 13,95 €
TOTAL 10,50 €
`;

const candidatesNoisy = scoreOcrCandidates(noisySample, []);
const acceptedNoisy = candidatesNoisy.find((c) => c.accepted);
assert(acceptedNoisy === undefined, `Noisy sample with no isolated 3-digit ticket should yield NO accepted candidate`);

forbiddenCandidates.forEach((fc) => {
  const match = candidatesNoisy.find((c) => c.candidate === fc);
  if (match) {
    assert(match.accepted === false, `Forbidden sub-candidate "${fc}" must be rejected`);
  } else {
    console.log(`✅ PASS: Forbidden sub-candidate "${fc}" was not even extracted as a valid candidate`);
  }
});

// 7. Test Extraction when keywords like FECHA or TOTAL are on the same line as the 3-digit ticket
const sameLineSample = `
FECHA: 13/08/2026 TICKET: 657 TOTAL: 15,00 €
`;

const candidatesSameLine = scoreOcrCandidates(sameLineSample, []);
const acceptedSameLine = candidatesSameLine.find((c) => c.accepted);
assert(acceptedSameLine?.candidate === '657', `Same line sample should extract 657, got: ${acceptedSameLine?.candidate}`);

// 8. Test Spaced 3-digit tickets (e.g. "6  5  7" or "3 2 9" or "  5 7 9  ")
const spacedSample1 = `
T001006/5057
6  5  7
COCINA
`;
const candSpaced1 = scoreOcrCandidates(spacedSample1, []);
const accSpaced1 = candSpaced1.find((c) => c.accepted);
assert(accSpaced1?.candidate === '657', `Spaced sample 1 should extract 657, got: ${accSpaced1?.candidate}`);

const spacedSample2 = `
T001003-8329
3 2 9
TOTAL 16,45 €
`;
const candSpaced2 = scoreOcrCandidates(spacedSample2, []);
const accSpaced2 = candSpaced2.find((c) => c.accepted);
assert(accSpaced2?.candidate === '329', `Spaced sample 2 should extract 329, got: ${accSpaced2?.candidate}`);

// 9. Test OCR Character Normalization (e.g. 'S79' -> '579', 'I79' -> '179', '3Z9' -> '329')
const ocrConfusedSample1 = `
S79
COCINA
`;
const candConfused1 = scoreOcrCandidates(ocrConfusedSample1, []);
const accConfused1 = candConfused1.find((c) => c.accepted);
assert(accConfused1?.candidate === '579', `OCR confused sample S79 should normalize to 579, got: ${accConfused1?.candidate}`);

const ocrConfusedSample2 = `
I79
BARRA
`;
const candConfused2 = scoreOcrCandidates(ocrConfusedSample2, []);
const accConfused2 = candConfused2.find((c) => c.accepted);
assert(accConfused2?.candidate === '179', `OCR confused sample I79 should normalize to 179, got: ${accConfused2?.candidate}`);

// 10. Test Multi-ticket Sequential Detection with CandidateTemporalTracker
import { CandidateTemporalTracker } from './ticketOCR';

const tracker = new CandidateTemporalTracker({ requiredStableFrames: 1 });

// Frame 1: Sees ticket 657
const eval657 = scoreOcrCandidates('657\nCOCINA')[0];
const lock1 = tracker.registerCandidate(eval657);
assert(lock1.lockedCandidate?.candidate === '657', `Tracker should lock 657 on frame 1, got: ${lock1.lockedCandidate?.candidate}`);

// Frame 2: Sees ticket 329
const eval329 = scoreOcrCandidates('329\nBARRA')[0];
const lock2 = tracker.registerCandidate(eval329);
assert(lock2.lockedCandidate?.candidate === '329', `Tracker should lock 329 immediately, got: ${lock2.lockedCandidate?.candidate}`);

// Frame 3: Sees ticket 579
const eval579 = scoreOcrCandidates('579\nLOCAL')[0];
const lock3 = tracker.registerCandidate(eval579);
assert(lock3.lockedCandidate?.candidate === '579', `Tracker should lock 579 immediately, got: ${lock3.lockedCandidate?.candidate}`);

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
