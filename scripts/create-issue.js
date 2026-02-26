#!/usr/bin/env node
// Daily Productivity Digest - GitHub Issue Creator
// Zero external dependencies. Runs in GitHub Actions.

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPO = process.env.GITHUB_REPOSITORY || 'WilliamZimZimma/Hormozi-Focus-Timer';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
    console.error('GITHUB_TOKEN not set');
    process.exit(1);
}

// --- Parsing helpers ---

function getTodayFilename() {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}-${days[now.getDay()]}.md`;
}

function parseDay(content) {
    let totalMinutes = 0;
    let totalIntervals = 0;
    let sessions = 0;
    const categories = { PROMOTE: 0, BUILD: 0, DELIVER: 0 };
    const tasks = [];

    const durationMatches = content.match(/\*\*Duration:\*\* (\d+) minutes \((\d+) intervals\)/g) || [];
    durationMatches.forEach(match => {
        const nums = match.match(/(\d+) minutes \((\d+) intervals\)/);
        if (nums) {
            totalMinutes += parseInt(nums[1]);
            totalIntervals += parseInt(nums[2]);
            sessions++;
        }
    });

    const promoteMatches = content.match(/- PROMOTE: (\d+) min/g) || [];
    promoteMatches.forEach(m => { const n = m.match(/(\d+)/); if (n) categories.PROMOTE += parseInt(n[1]); });

    const buildMatches = content.match(/- BUILD: (\d+) min/g) || [];
    buildMatches.forEach(m => { const n = m.match(/(\d+)/); if (n) categories.BUILD += parseInt(n[1]); });

    const deliverMatches = content.match(/- DELIVER: (\d+) min/g) || [];
    deliverMatches.forEach(m => { const n = m.match(/(\d+)/); if (n) categories.DELIVER += parseInt(n[1]); });

    // Extract task names from session log entries like "- 2:30 PM: Switched to BUILD — Working on API"
    const logEntries = content.match(/- \d+:\d+ [AP]M: .+/g) || [];
    logEntries.forEach(entry => {
        const taskMatch = entry.match(/(?:Started|Switched to \w+ —|Working on) (.+)/i);
        if (taskMatch) {
            const task = taskMatch[1].trim();
            if (task && !tasks.includes(task)) tasks.push(task);
        }
    });

    return { totalMinutes, totalIntervals, sessions, categories, tasks };
}

function getDataFiles() {
    if (!fs.existsSync(DATA_DIR)) return [];
    return fs.readdirSync(DATA_DIR)
        .filter(f => f.match(/^\d{4}-\d{2}-\d{2}-.+\.md$/))
        .sort();
}

function calculateStreak(files) {
    if (files.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Walk backwards from today
    for (let i = 0; i <= 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

        const hasFile = files.some(f => f.startsWith(dateStr));
        if (hasFile) {
            streak++;
        } else if (i > 0) {
            // Gap found (skip today if no file yet - might not have worked yet)
            break;
        }
    }
    return streak;
}

function get7DayAverage(files) {
    const last7 = files.slice(-7);
    if (last7.length === 0) return 0;

    let total = 0;
    last7.forEach(file => {
        const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
        const parsed = parseDay(content);
        total += parsed.totalMinutes;
    });
    return Math.round(total / last7.length);
}

function progressBar(value, max, width = 20) {
    if (max === 0) return '░'.repeat(width);
    const filled = Math.round((value / max) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function formatMinutes(mins) {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// --- Build the digest ---

function buildDigest() {
    const todayFile = getTodayFilename();
    const todayPath = path.join(DATA_DIR, todayFile);

    if (!fs.existsSync(todayPath)) {
        console.log(`No data file for today: ${todayFile}`);
        process.exit(0);
    }

    const content = fs.readFileSync(todayPath, 'utf8');
    const today = parseDay(content);

    if (today.totalMinutes === 0) {
        console.log('No focus time recorded today.');
        process.exit(0);
    }

    const files = getDataFiles();
    const streak = calculateStreak(files);
    const avg7 = get7DayAverage(files.slice(0, -1)); // Exclude today for fair comparison
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Title
    const title = `${dayName} ${dateStr}: ${formatMinutes(today.totalMinutes)} focused (${today.sessions} session${today.sessions !== 1 ? 's' : ''})`;

    // Body
    let body = '';

    // Streak
    if (streak > 1) {
        body += `🔥 **${streak}-day streak!**\n\n`;
    }

    // Summary table
    body += `## Summary\n\n`;
    body += `| Metric | Value |\n`;
    body += `|--------|-------|\n`;
    body += `| Total Focus Time | **${formatMinutes(today.totalMinutes)}** |\n`;
    body += `| Sessions | ${today.sessions} |\n`;
    body += `| Intervals | ${today.totalIntervals} |\n`;
    body += `| 7-Day Average | ${avg7 > 0 ? formatMinutes(avg7) : 'N/A'} |\n`;

    // Comparison
    if (avg7 > 0) {
        const diff = today.totalMinutes - avg7;
        const pct = Math.round((diff / avg7) * 100);
        const arrow = diff >= 0 ? '📈' : '📉';
        body += `| vs. Average | ${arrow} ${diff >= 0 ? '+' : ''}${formatMinutes(Math.abs(diff))} (${diff >= 0 ? '+' : ''}${pct}%) |\n`;
    }

    body += `\n`;

    // Category breakdown
    body += `## Category Breakdown\n\n`;
    const maxCat = Math.max(today.categories.PROMOTE, today.categories.BUILD, today.categories.DELIVER, 1);

    ['PROMOTE', 'BUILD', 'DELIVER'].forEach(cat => {
        const mins = today.categories[cat];
        const pct = today.totalMinutes > 0 ? Math.round((mins / today.totalMinutes) * 100) : 0;
        body += `**${cat}** ${formatMinutes(mins)} (${pct}%)\n`;
        body += `\`${progressBar(mins, maxCat)}\`\n\n`;
    });

    // Tasks worked on
    if (today.tasks.length > 0) {
        body += `## Tasks\n\n`;
        today.tasks.forEach(task => {
            body += `- ${task}\n`;
        });
        body += `\n`;
    }

    // Footer
    body += `---\n*Auto-generated by [Hormozi Focus Timer](https://github.com/${REPO})*`;

    return { title, body };
}

// --- GitHub API ---

function createIssue(title, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ title, body, labels: ['daily-digest'] });

        const options = {
            hostname: 'api.github.com',
            path: `/repos/${REPO}/issues`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'User-Agent': 'Hormozi-Focus-Timer',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                if (res.statusCode === 201) {
                    const issue = JSON.parse(responseData);
                    resolve(issue);
                } else {
                    reject(new Error(`GitHub API returned ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Ensure the daily-digest label exists (create if missing)
function ensureLabel() {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            name: 'daily-digest',
            color: 'f9a825',
            description: 'Automated daily productivity digest'
        });

        const options = {
            hostname: 'api.github.com',
            path: `/repos/${REPO}/labels`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'User-Agent': 'Hormozi-Focus-Timer',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => resolve()); // Don't care if it already exists (422)
        });

        req.on('error', () => resolve()); // Non-fatal
        req.write(data);
        req.end();
    });
}

// --- Main ---

async function main() {
    console.log('Building daily digest...');
    const { title, body } = buildDigest();

    console.log(`Title: ${title}`);
    console.log(`Body length: ${body.length} chars`);

    await ensureLabel();
    const issue = await createIssue(title, body);

    console.log(`Issue created: ${issue.html_url}`);
}

main().catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
});
