const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3847;
const TRACKER_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(TRACKER_DIR)) {
    fs.mkdirSync(TRACKER_DIR, { recursive: true });
}

// Get today's filename
function getTodayFilename() {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dayName = days[now.getDay()];
    return `${year}-${month}-${day}-${dayName}.md`;
}

// Get formatted date for header
function getFormattedDate() {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Create or get today's tracker file
function ensureDailyFile() {
    const filename = getTodayFilename();
    const filepath = path.join(TRACKER_DIR, filename);

    if (!fs.existsSync(filepath)) {
        const template = `# Time Tracker - ${getFormattedDate()}

## Focus Timer Sessions

`;
        fs.writeFileSync(filepath, template);
        console.log(`Created new tracker: ${filename}`);
    }

    return filepath;
}

// Append session data to daily tracker
function appendSession(data) {
    const filepath = ensureDailyFile();
    const content = fs.readFileSync(filepath, 'utf8');

    const sessionNum = (content.match(/### Session \d+/g) || []).length + 1;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    let sessionEntry = `
### Session ${sessionNum}: Focus Block
**Ended:** ${timeStr}
**Duration:** ${data.totalMinutes} minutes (${data.intervals} intervals)

**Category Breakdown:**
- PROMOTE: ${data.promote} min
- BUILD: ${data.build} min
- DELIVER: ${data.deliver} min

**Session Log:**
${data.log.map(entry => `- ${entry.time}: ${entry.message}`).join('\n')}

---
`;

    fs.appendFileSync(filepath, sessionEntry);
    console.log(`Saved session to ${getTodayFilename()}`);
    return { success: true, file: getTodayFilename() };
}

// Generate weekly summary
function generateWeeklySummary() {
    const files = fs.readdirSync(TRACKER_DIR)
        .filter(f => f.match(/^\d{4}-\d{2}-\d{2}-.+\.md$/))
        .sort()
        .slice(-7); // Last 7 days

    let totalMinutes = 0;
    let totalIntervals = 0;
    let categoryTotals = { PROMOTE: 0, BUILD: 0, DELIVER: 0 };
    let dailyBreakdown = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(TRACKER_DIR, file), 'utf8');

        // Parse duration from sessions
        const durations = content.match(/\*\*Duration:\*\* (\d+) minutes \((\d+) intervals\)/g) || [];
        let dayMinutes = 0;
        let dayIntervals = 0;

        durations.forEach(match => {
            const nums = match.match(/(\d+) minutes \((\d+) intervals\)/);
            if (nums) {
                dayMinutes += parseInt(nums[1]);
                dayIntervals += parseInt(nums[2]);
            }
        });

        // Parse categories
        const promoteMatch = content.match(/- PROMOTE: (\d+) min/g) || [];
        const buildMatch = content.match(/- BUILD: (\d+) min/g) || [];
        const deliverMatch = content.match(/- DELIVER: (\d+) min/g) || [];

        promoteMatch.forEach(m => {
            const n = m.match(/(\d+)/);
            if (n) categoryTotals.PROMOTE += parseInt(n[1]);
        });
        buildMatch.forEach(m => {
            const n = m.match(/(\d+)/);
            if (n) categoryTotals.BUILD += parseInt(n[1]);
        });
        deliverMatch.forEach(m => {
            const n = m.match(/(\d+)/);
            if (n) categoryTotals.DELIVER += parseInt(n[1]);
        });

        totalMinutes += dayMinutes;
        totalIntervals += dayIntervals;

        if (dayMinutes > 0) {
            dailyBreakdown.push({
                date: file.replace('.md', ''),
                minutes: dayMinutes,
                intervals: dayIntervals
            });
        }
    });

    const totalHours = (totalMinutes / 60).toFixed(1);
    const avgDaily = dailyBreakdown.length > 0 ? Math.round(totalMinutes / dailyBreakdown.length) : 0;

    const summary = {
        period: `${files[0]?.replace('.md', '') || 'N/A'} to ${files[files.length - 1]?.replace('.md', '') || 'N/A'}`,
        totalHours,
        totalMinutes,
        totalIntervals,
        avgDailyMinutes: avgDaily,
        categories: categoryTotals,
        dailyBreakdown
    };

    // Also save as markdown
    const summaryMd = `# Weekly Summary
**Period:** ${summary.period}

## Totals
- **Total Focus Time:** ${totalHours} hours (${totalMinutes} min)
- **Total Intervals:** ${totalIntervals}
- **Average Daily:** ${avgDaily} min

## Category Breakdown
- **PROMOTE:** ${categoryTotals.PROMOTE} min (${totalMinutes > 0 ? Math.round(categoryTotals.PROMOTE / totalMinutes * 100) : 0}%)
- **BUILD:** ${categoryTotals.BUILD} min (${totalMinutes > 0 ? Math.round(categoryTotals.BUILD / totalMinutes * 100) : 0}%)
- **DELIVER:** ${categoryTotals.DELIVER} min (${totalMinutes > 0 ? Math.round(categoryTotals.DELIVER / totalMinutes * 100) : 0}%)

## Daily Breakdown
${dailyBreakdown.map(d => `- ${d.date}: ${d.minutes} min (${d.intervals} intervals)`).join('\n')}

---
*Generated: ${new Date().toLocaleString()}*
`;

    const summaryFile = path.join(TRACKER_DIR, 'WEEKLY-SUMMARY.md');
    fs.writeFileSync(summaryFile, summaryMd);

    return summary;
}

// Simple CORS headers
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Server
const server = http.createServer((req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/save') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const result = appendSession(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                console.error('Error saving:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/weekly') {
        try {
            const summary = generateWeeklySummary();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(summary));
        } catch (err) {
            console.error('Error generating weekly:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    if (req.method === 'GET' && req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', file: getTodayFilename() }));
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  Hormozi Focus Timer Server`);
    console.log(`  Port: ${PORT}`);
    console.log(`  Saving to: ${TRACKER_DIR}`);
    console.log(`  Today's file: ${getTodayFilename()}`);
    console.log(`========================================\n`);
    console.log(`Endpoints:`);
    console.log(`  POST /save   - Save a session`);
    console.log(`  GET  /weekly - Generate weekly summary`);
    console.log(`  GET  /ping   - Check server status\n`);
});
