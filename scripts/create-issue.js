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
    const sessionDurations = []; // minutes per session
    const sessionTimes = []; // "Ended" timestamps

    // Parse each session block
    const durationMatches = content.match(/\*\*Duration:\*\* (\d+) minutes \((\d+) intervals\)/g) || [];
    durationMatches.forEach(match => {
        const nums = match.match(/(\d+) minutes \((\d+) intervals\)/);
        if (nums) {
            const mins = parseInt(nums[1]);
            totalMinutes += mins;
            totalIntervals += parseInt(nums[2]);
            sessions++;
            sessionDurations.push(mins);
        }
    });

    // Parse end times
    const endedMatches = content.match(/\*\*Ended:\*\* (.+)/g) || [];
    endedMatches.forEach(m => {
        const timeStr = m.replace('**Ended:** ', '').trim();
        sessionTimes.push(timeStr);
    });

    // Parse categories
    const promoteMatches = content.match(/- PROMOTE: (\d+) min/g) || [];
    promoteMatches.forEach(m => { const n = m.match(/(\d+)/); if (n) categories.PROMOTE += parseInt(n[1]); });

    const buildMatches = content.match(/- BUILD: (\d+) min/g) || [];
    buildMatches.forEach(m => { const n = m.match(/(\d+)/); if (n) categories.BUILD += parseInt(n[1]); });

    const deliverMatches = content.match(/- DELIVER: (\d+) min/g) || [];
    deliverMatches.forEach(m => { const n = m.match(/(\d+)/); if (n) categories.DELIVER += parseInt(n[1]); });

    // Extract task names from session log entries
    const logEntries = content.match(/- \d+:\d+ [AP]M: .+/g) || [];
    logEntries.forEach(entry => {
        const taskMatch = entry.match(/(?:Started|Switched to \w+ —|Working on) (.+)/i);
        if (taskMatch) {
            const task = taskMatch[1].trim();
            if (task && !tasks.includes(task)) tasks.push(task);
        }
    });

    return { totalMinutes, totalIntervals, sessions, categories, tasks, sessionDurations, sessionTimes };
}

function getDataFiles() {
    if (!fs.existsSync(DATA_DIR)) return [];
    return fs.readdirSync(DATA_DIR)
        .filter(f => f.match(/^\d{4}-\d{2}-\d{2}-.+\.md$/))
        .sort();
}

// Parse all historical data files into an array of { filename, date, dayOfWeek, ...parseDay }
function parseAllDays(files) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return files.map(file => {
        const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
        const parsed = parseDay(content);
        // Extract day of week from filename like 2026-02-26-Thursday.md
        const dayMatch = file.match(/\d{4}-\d{2}-\d{2}-(\w+)\.md/);
        const dayOfWeek = dayMatch ? dayMatch[1] : '';
        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
        const date = dateMatch ? dateMatch[1] : '';
        return { filename: file, date, dayOfWeek, ...parsed };
    });
}

function calculateStreak(files) {
    if (files.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i <= 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;

        const hasFile = files.some(f => f.startsWith(dateStr));
        if (hasFile) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }
    return streak;
}

function progressBar(value, max, width = 20) {
    if (max === 0) return '░'.repeat(width);
    const filled = Math.round((value / max) * width);
    return '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(width - filled, 0));
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
    const allDays = parseAllDays(files);
    const streak = calculateStreak(files);
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Historical stats (excluding today for fair comparisons)
    const pastDays = allDays.filter(d => d.filename !== todayFile);
    const past7 = pastDays.slice(-7);
    const avg7 = past7.length > 0 ? Math.round(past7.reduce((s, d) => s + d.totalMinutes, 0) / past7.length) : 0;

    // All-time best
    const allTimeBest = allDays.reduce((best, d) => d.totalMinutes > best.totalMinutes ? d : best, { totalMinutes: 0 });
    const isPersonalRecord = today.totalMinutes >= allTimeBest.totalMinutes && allDays.length > 1;

    // Today's session stats
    const avgSessionLength = today.sessions > 0 ? Math.round(today.totalMinutes / today.sessions) : 0;
    const longestSession = today.sessionDurations.length > 0 ? Math.max(...today.sessionDurations) : 0;
    const shortestSession = today.sessionDurations.length > 1 ? Math.min(...today.sessionDurations) : 0;
    const earliestTime = today.sessionTimes.length > 0 ? today.sessionTimes[0] : null;
    const latestTime = today.sessionTimes.length > 0 ? today.sessionTimes[today.sessionTimes.length - 1] : null;

    // Dominant category today
    const catEntries = Object.entries(today.categories);
    catEntries.sort((a, b) => b[1] - a[1]);
    const dominantCategory = catEntries[0][1] > 0 ? catEntries[0][0] : null;

    // Weekly total (last 7 days including today)
    const last7Including = allDays.slice(-7);
    const weeklyTotal = last7Including.reduce((s, d) => s + d.totalMinutes, 0);

    // Day-of-week patterns (all-time)
    const dowTotals = {};
    const dowCounts = {};
    allDays.forEach(d => {
        if (!dowTotals[d.dayOfWeek]) { dowTotals[d.dayOfWeek] = 0; dowCounts[d.dayOfWeek] = 0; }
        dowTotals[d.dayOfWeek] += d.totalMinutes;
        dowCounts[d.dayOfWeek]++;
    });
    const dowAverages = {};
    Object.keys(dowTotals).forEach(day => {
        dowAverages[day] = Math.round(dowTotals[day] / dowCounts[day]);
    });

    // Category trend: this week vs last week
    const thisWeekDays = allDays.slice(-7);
    const prevWeekDays = allDays.length > 7 ? allDays.slice(-14, -7) : [];
    const thisWeekCats = { PROMOTE: 0, BUILD: 0, DELIVER: 0 };
    const prevWeekCats = { PROMOTE: 0, BUILD: 0, DELIVER: 0 };
    thisWeekDays.forEach(d => { thisWeekCats.PROMOTE += d.categories.PROMOTE; thisWeekCats.BUILD += d.categories.BUILD; thisWeekCats.DELIVER += d.categories.DELIVER; });
    prevWeekDays.forEach(d => { prevWeekCats.PROMOTE += d.categories.PROMOTE; prevWeekCats.BUILD += d.categories.BUILD; prevWeekCats.DELIVER += d.categories.DELIVER; });

    // --- Build Issue body ---

    // Title
    const title = `${dayName} ${dateStr}: ${formatMinutes(today.totalMinutes)} focused (${today.sessions} session${today.sessions !== 1 ? 's' : ''})`;

    let body = '';

    // Streak + personal record callouts
    if (isPersonalRecord) {
        body += `🏆 **NEW PERSONAL RECORD!**\n\n`;
    }
    if (streak > 1) {
        body += `🔥 **${streak}-day streak!**\n\n`;
    }

    // ---- TODAY'S SUMMARY ----
    body += `## Today's Summary\n\n`;
    body += `| Metric | Value |\n`;
    body += `|--------|-------|\n`;
    body += `| Total Focus Time | **${formatMinutes(today.totalMinutes)}** |\n`;
    body += `| Sessions | ${today.sessions} |\n`;
    body += `| Intervals | ${today.totalIntervals} |\n`;
    if (today.sessions > 0) {
        body += `| Avg Session Length | ${formatMinutes(avgSessionLength)} |\n`;
    }
    if (today.sessions > 1) {
        body += `| Longest Session | ${formatMinutes(longestSession)} |\n`;
        body += `| Shortest Session | ${formatMinutes(shortestSession)} |\n`;
    }
    if (earliestTime) {
        body += `| First Session Ended | ${earliestTime} |\n`;
    }
    if (latestTime && latestTime !== earliestTime) {
        body += `| Last Session Ended | ${latestTime} |\n`;
    }
    if (dominantCategory) {
        body += `| Dominant Category | **${dominantCategory}** |\n`;
    }
    body += `\n`;

    // ---- CATEGORY BREAKDOWN ----
    body += `## Category Breakdown\n\n`;
    const maxCat = Math.max(today.categories.PROMOTE, today.categories.BUILD, today.categories.DELIVER, 1);

    ['PROMOTE', 'BUILD', 'DELIVER'].forEach(cat => {
        const mins = today.categories[cat];
        const pct = today.totalMinutes > 0 ? Math.round((mins / today.totalMinutes) * 100) : 0;
        body += `**${cat}** ${formatMinutes(mins)} (${pct}%)\n`;
        body += `\`${progressBar(mins, maxCat)}\`\n\n`;
    });

    // ---- SESSION DETAILS ----
    if (today.sessions > 0) {
        body += `## Session Details\n\n`;
        body += `| # | Duration | Intervals | Ended |\n`;
        body += `|---|----------|-----------|-------|\n`;
        for (let i = 0; i < today.sessions; i++) {
            const dur = today.sessionDurations[i] || 0;
            const time = today.sessionTimes[i] || '—';
            const intervals = dur > 0 ? Math.ceil(dur / 15) : '—'; // Approximate from duration
            body += `| ${i + 1} | ${formatMinutes(dur)} | ~${intervals} | ${time} |\n`;
        }
        body += `\n`;
    }

    // ---- TASKS ----
    if (today.tasks.length > 0) {
        body += `## Tasks Worked On\n\n`;
        today.tasks.forEach(task => {
            body += `- ${task}\n`;
        });
        body += `\n`;
    }

    // ---- vs. AVERAGES ----
    body += `## vs. Averages\n\n`;
    body += `| Comparison | Value |\n`;
    body += `|------------|-------|\n`;

    if (avg7 > 0) {
        const diff7 = today.totalMinutes - avg7;
        const pct7 = Math.round((diff7 / avg7) * 100);
        const arrow7 = diff7 >= 0 ? '📈' : '📉';
        body += `| 7-Day Average | ${formatMinutes(avg7)} |\n`;
        body += `| Today vs. 7-Day | ${arrow7} ${diff7 >= 0 ? '+' : ''}${formatMinutes(Math.abs(diff7))} (${diff7 >= 0 ? '+' : ''}${pct7}%) |\n`;
    } else {
        body += `| 7-Day Average | N/A (not enough data) |\n`;
    }

    // All-time average
    if (allDays.length > 1) {
        const allTimeAvg = Math.round(allDays.reduce((s, d) => s + d.totalMinutes, 0) / allDays.length);
        const diffAll = today.totalMinutes - allTimeAvg;
        const pctAll = allTimeAvg > 0 ? Math.round((diffAll / allTimeAvg) * 100) : 0;
        const arrowAll = diffAll >= 0 ? '📈' : '📉';
        body += `| All-Time Average | ${formatMinutes(allTimeAvg)} |\n`;
        body += `| Today vs. All-Time | ${arrowAll} ${diffAll >= 0 ? '+' : ''}${formatMinutes(Math.abs(diffAll))} (${diffAll >= 0 ? '+' : ''}${pctAll}%) |\n`;
    }

    body += `\n`;

    // ---- WEEKLY ROLLUP ----
    body += `## This Week\n\n`;
    body += `| Metric | Value |\n`;
    body += `|--------|-------|\n`;
    body += `| Weekly Total | **${formatMinutes(weeklyTotal)}** |\n`;
    body += `| Days Active | ${last7Including.length} |\n`;
    if (last7Including.length > 0) {
        body += `| Daily Average | ${formatMinutes(Math.round(weeklyTotal / last7Including.length))} |\n`;
    }
    body += `\n`;

    // Category trend vs last week
    if (prevWeekDays.length > 0) {
        const thisWeekTotal = thisWeekCats.PROMOTE + thisWeekCats.BUILD + thisWeekCats.DELIVER;
        const prevWeekTotal = prevWeekCats.PROMOTE + prevWeekCats.BUILD + prevWeekCats.DELIVER;

        body += `### Category Trend (This Week vs. Last Week)\n\n`;
        body += `| Category | This Week | Last Week | Shift |\n`;
        body += `|----------|-----------|-----------|-------|\n`;

        ['PROMOTE', 'BUILD', 'DELIVER'].forEach(cat => {
            const thisPct = thisWeekTotal > 0 ? Math.round((thisWeekCats[cat] / thisWeekTotal) * 100) : 0;
            const prevPct = prevWeekTotal > 0 ? Math.round((prevWeekCats[cat] / prevWeekTotal) * 100) : 0;
            const shift = thisPct - prevPct;
            const arrow = shift > 0 ? '↑' : shift < 0 ? '↓' : '→';
            body += `| ${cat} | ${thisPct}% | ${prevPct}% | ${arrow} ${Math.abs(shift)}% |\n`;
        });

        body += `\n`;
    }

    // ---- ALL-TIME RECORDS ----
    if (allDays.length > 1) {
        body += `## All-Time Records\n\n`;
        body += `| Record | Value |\n`;
        body += `|--------|-------|\n`;

        // Best day
        body += `| Best Day | ${formatMinutes(allTimeBest.totalMinutes)} (${allTimeBest.date}) |\n`;

        // Total days tracked
        body += `| Days Tracked | ${allDays.length} |\n`;

        // Longest streak (calculate)
        let longestStreak = 0;
        let currentStreak = 0;
        const allDates = allDays.map(d => d.date).sort();
        if (allDates.length > 0) {
            currentStreak = 1;
            for (let i = 1; i < allDates.length; i++) {
                const prev = new Date(allDates[i - 1]);
                const curr = new Date(allDates[i]);
                const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    currentStreak++;
                } else {
                    longestStreak = Math.max(longestStreak, currentStreak);
                    currentStreak = 1;
                }
            }
            longestStreak = Math.max(longestStreak, currentStreak);
        }
        body += `| Longest Streak | ${longestStreak} day${longestStreak !== 1 ? 's' : ''} |\n`;

        // Total all-time hours
        const allTimeMinutes = allDays.reduce((s, d) => s + d.totalMinutes, 0);
        body += `| Total All-Time | ${formatMinutes(allTimeMinutes)} |\n`;

        body += `\n`;
    }

    // ---- DAY-OF-WEEK PATTERNS ----
    if (Object.keys(dowAverages).length > 2) {
        const orderedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const activeDays = orderedDays.filter(d => dowAverages[d]);

        if (activeDays.length > 2) {
            body += `## Day-of-Week Averages\n\n`;

            const maxDow = Math.max(...activeDays.map(d => dowAverages[d]));

            activeDays.forEach(day => {
                const avg = dowAverages[day];
                const isToday = day === dayName;
                const marker = isToday ? ' ← today' : '';
                body += `**${day.slice(0, 3)}** ${formatMinutes(avg)} \`${progressBar(avg, maxDow, 15)}\`${marker}\n`;
            });

            body += `\n`;

            // Best/worst day
            const bestDay = activeDays.reduce((a, b) => dowAverages[a] > dowAverages[b] ? a : b);
            const worstDay = activeDays.reduce((a, b) => dowAverages[a] < dowAverages[b] ? a : b);
            body += `Most productive day: **${bestDay}** (avg ${formatMinutes(dowAverages[bestDay])})\n`;
            body += `Least productive day: **${worstDay}** (avg ${formatMinutes(dowAverages[worstDay])})\n\n`;
        }
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
            res.on('end', () => resolve());
        });

        req.on('error', () => resolve());
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
