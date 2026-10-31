import { readFile } from 'node:fs/promises';

const profile = JSON.parse(await readFile(new URL('../docs/startup-credits/profile.json', import.meta.url), 'utf8'));
const privateEmailHosts = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com']);
let domain = '';
try { const url = new URL(`https://${profile.customDomain}`); if (profile.customDomain && url.hostname === profile.customDomain && !url.username && !url.password && url.pathname === '/' && url.hostname.includes('.')) domain = url.hostname.toLowerCase(); } catch {}
const emailHost = typeof profile.businessEmail === 'string' ? profile.businessEmail.toLowerCase().split('@')[1] : '';
const emailMatches = !!domain && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.businessEmail || '') && emailHost === domain && !privateEmailHosts.has(emailHost);
const now = new Date();
const founded = /^\d{4}-\d{2}-\d{2}$/.test(profile.foundedDate || '') ? new Date(`${profile.foundedDate}T00:00:00Z`) : null;
const validDate = !!founded && Number.isFinite(founded.getTime()) && founded.toISOString().slice(0, 10) === profile.foundedDate && founded <= now;
const foundedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(profile.foundedMonth || '') ? new Date(`${profile.foundedMonth}-01T00:00:00Z`) : null;
const validMonth = !!foundedMonth && foundedMonth <= now;
const screeningStart = validDate ? founded : validMonth ? foundedMonth : null;
const months = screeningStart ? (now.getUTCFullYear() - screeningStart.getUTCFullYear()) * 12 + now.getUTCMonth() - screeningStart.getUTCMonth() : Infinity;
const common = [
  ['An owned custom domain has been configured', !!domain],
  ['A matching business-domain mailbox has been verified', emailMatches],
  ['Founder-confirmed project start month is supplied (not incorporation)', validDate || validMonth],
  ['The new public website release has been verified', profile.publicWebsiteReleaseVerified === true],
  ['A cloud calculator budget has been reviewed', profile.cloudBudgetReviewed === true],
];
const aws = [
  ['Project start is within 10 years (month-based screening; program decides)', months < 120],
  ['No previous AWS startup credits reported', profile.previousAwsStartupCredits === false],
  ['Eligible AWS Paid Tier account is ready', profile.awsPaidTierAccountReady === true],
  ['AWS accepted applicant/legal status has been confirmed', profile.awsApplicantStatusConfirmed === true],
];
const google = [
  ['Project start is within 24 months (month-based screening; program decides)', months < 24],
  ['Founder intends to seek venture funding soon', profile.intendsToSeekVentureFundingSoon === true],
  ['No previous Google startup credits reported', profile.previousGoogleStartupCredits === false],
  ['Google Cloud billing account is ready', profile.googleBillingAccountReady === true],
  ['Google accepted applicant/legal status has been confirmed', profile.googleApplicantStatusConfirmed === true],
];
console.log('GhostPay application preparation — founder-maintained declarations, not a provider eligibility decision.\n');
for (const [title, entries] of [['Shared prerequisites', common], ['AWS Founders', aws], ['Google Start', google]]) {
  console.log(title);
  for (const [label, ok] of entries) console.log(`  ${ok ? 'RECORDED' : 'PENDING'}: ${label}`);
  console.log('');
}
console.log(`${profile.twoWalletPublicDemoRecorded ? 'RECORDED' : 'RECOMMENDED, PENDING'}: actual two-wallet public testnet demo recording`);
console.log('Business model: proposed and unvalidated. Customer traction/revenue: not claimed.');
console.log('Do not store cloud account identifiers, credentials or payment details in profile.json.');
if (process.argv.includes('--strict') && [...common, ...aws, ...google].some(([, ok]) => !ok)) process.exitCode = 1;
