const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'EmperorKunDis';
const REPO_NAME = 'WebProChalengeISS2';
const SCORES_PATH = 'scores';
const BRANCH = 'main';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return await getScores(req, res);
    }

    if (req.method === 'POST') {
        return await saveScore(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function getScores(req, res) {
    try {
        // Get list of files in scores directory
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SCORES_PATH}?ref=${BRANCH}`,
            {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!response.ok) {
            if (response.status === 404) {
                return res.status(200).json({ scores: [] });
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const files = await response.json();

        if (!Array.isArray(files)) {
            return res.status(200).json({ scores: [] });
        }

        // Filter only JSON files
        const jsonFiles = files.filter(f => f.name.endsWith('.json'));

        // Fetch content of each file
        const scores = [];
        for (const file of jsonFiles) {
            try {
                const contentResponse = await fetch(file.download_url);
                if (contentResponse.ok) {
                    const scoreData = await contentResponse.json();
                    scores.push(scoreData);
                }
            } catch (e) {
                console.error(`Error reading ${file.name}:`, e);
            }
        }

        // Sort by score descending and return top 10
        scores.sort((a, b) => b.score - a.score);
        const top10 = scores.slice(0, 10);

        return res.status(200).json({ scores: top10 });
    } catch (error) {
        console.error('Error fetching scores:', error);
        return res.status(500).json({ error: 'Failed to fetch scores' });
    }
}

async function saveScore(req, res) {
    try {
        const { name, score } = req.body;

        if (!name || typeof score !== 'number') {
            return res.status(400).json({ error: 'Invalid data' });
        }

        // Create unique filename with timestamp
        const timestamp = Date.now();
        const filename = `score_${timestamp}_${Math.random().toString(36).substr(2, 9)}.json`;
        const filepath = `${SCORES_PATH}/${filename}`;

        const scoreData = {
            name: name.substring(0, 15),
            score: score,
            date: new Date().toISOString(),
            id: timestamp
        };

        // Create file via GitHub API
        const content = Buffer.from(JSON.stringify(scoreData, null, 2)).toString('base64');

        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filepath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Add score: ${name} - ${score}`,
                    content: content,
                    branch: BRANCH
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('GitHub API error:', errorData);
            throw new Error(`GitHub API error: ${response.status}`);
        }

        return res.status(200).json({ success: true, score: scoreData });
    } catch (error) {
        console.error('Error saving score:', error);
        return res.status(500).json({ error: 'Failed to save score' });
    }
}
