// Global variables
let heptabaseData = null;

// DOM elements
const fileInput = document.getElementById('fileInput');
const fileInputLabel = document.getElementById('fileInputLabel');
const fileName = document.getElementById('fileName');
const downloadSection = document.getElementById('downloadSection');
const downloadCardsBtn = document.getElementById('downloadCardsBtn');
const downloadCanvasBtn = document.getElementById('downloadCanvasBtn');
const cardsPathInput = document.getElementById('cardsPath');
const statusDiv = document.getElementById('status');

// Event listeners
fileInput.addEventListener('change', handleFileUpload);
downloadCardsBtn.addEventListener('click', downloadCards);
downloadCanvasBtn.addEventListener('click', downloadCanvas);

// Update file label on file selection
fileInput.addEventListener('change', function() {
    if (this.files && this.files[0]) {
        fileName.textContent = `Selected: ${this.files[0].name}`;
    }
});

/**
 * Handle file upload and parse JSON
 */
function handleFileUpload(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    if (!file.name.endsWith('.json')) {
        showStatus('Please upload a valid JSON file', 'error');
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            heptabaseData = JSON.parse(e.target.result);
            console.log('Data loaded:', Object.keys(heptabaseData));

            // Validate data structure
            if (!heptabaseData.cardList || !heptabaseData.whiteBoardList) {
                throw new Error('Invalid Heptabase data format');
            }

            showStatus(`Successfully loaded ${heptabaseData.cardList.length} cards and ${heptabaseData.whiteBoardList.length} whiteboards`, 'success');
            downloadSection.classList.remove('hidden');
        } catch (error) {
            showStatus(`Error parsing JSON: ${error.message}`, 'error');
            console.error(error);
        }
    };

    reader.onerror = function() {
        showStatus('Error reading file', 'error');
    };

    reader.readAsText(file);
}

/**
 * Find card by ID
 */
function findCard(uid) {
    return heptabaseData.cardList.find(card => card.id === uid);
}

/**
 * Find whiteboard by ID
 */
function findWhiteboard(uid) {
    return heptabaseData.whiteBoardList.find(wb => wb.id === uid);
}

/**
 * Find card instance by ID
 */
function findCardInstance(uid) {
    return heptabaseData.cardInstances.find(ci => ci.id === uid);
}

/**
 * Process cards and convert card references to wiki links
 */
function processCards() {
    const pattern = /\{\{card\s([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\}\}/g;
    const markdownList = [];

    for (let card of heptabaseData.cardList) {
        if (card.isTrashed) {
            continue;
        }

        // Handle forward slashes in title
        let title = card.title;
        if (title.includes('/')) {
            title = title.replace(/\//g, '!');
        }

        // Skip empty titles
        if (title === '') {
            continue;
        }

        // Replace card references with wiki links
        let content = card.content;
        const matches = content.matchAll(pattern);

        for (let match of matches) {
            const uid = match[1];
            const referencedCard = findCard(uid);
            if (referencedCard) {
                const link = `[[${referencedCard.title}]]`;
                content = content.replace(`{{card ${uid}}}`, link);
            }
        }

        markdownList.push({
            filename: `${title}.md`,
            content: content
        });
    }

    return markdownList;
}

/**
 * Detect connection direction based on positions
 */
function detectDirection(begin, end) {
    const xDiff = begin.x - end.x;
    const yDiff = begin.y - end.y;

    const angle = Math.atan2(yDiff, xDiff);
    const angleDeg = angle * (180 / Math.PI);

    console.log('Angle:', angleDeg);

    if (angleDeg > 45 && angleDeg < 135) {
        return { fromSide: 'bottom', toSide: 'top' };
    } else if (angleDeg > 135 || angleDeg < -135) {
        return { fromSide: 'left', toSide: 'right' };
    } else if (angleDeg < -45 && angleDeg > -135) {
        return { fromSide: 'top', toSide: 'bottom' };
    } else {
        return { fromSide: 'right', toSide: 'left' };
    }
}

/**
 * Find node in canvas by position
 */
function findNode(cardInstance, nodes) {
    return nodes.find(node =>
        cardInstance.x === node.x && cardInstance.y === node.y
    );
}

/**
 * Generate random hex ID
 */
function generateId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Create canvas data for a whiteboard
 */
function createCanvas(whiteboard, cardsPath) {
    const result = { nodes: [], edges: [] };

    // Add card nodes
    for (let node of whiteboard.nodes) {
        const card = findCard(node.cardId);
        if (!card) continue;

        let title = card.title;
        if (title.includes('/')) {
            title = title.replace(/\//g, '!');
        }

        result.nodes.push({
            id: generateId(),
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height - 30,
            type: 'file',
            file: `${cardsPath}${title}.md`
        });
    }

    // Add section nodes
    for (let section of whiteboard.sections) {
        result.nodes.push({
            id: generateId(),
            x: section.x,
            y: section.y,
            width: section.width,
            height: section.height,
            type: 'group',
            label: section.title
        });
    }

    // Add edges
    for (let connection of whiteboard.edges) {
        if (connection.beginObjectType === 'cardInstance' &&
            connection.endObjectType === 'cardInstance') {

            const begin = findCardInstance(connection.beginId);
            const end = findCardInstance(connection.endId);

            if (!begin || !end) continue;

            const fromNode = findNode(begin, result.nodes);
            const toNode = findNode(end, result.nodes);

            if (!fromNode || !toNode) continue;

            const { fromSide, toSide } = detectDirection(begin, end);

            result.edges.push({
                id: generateId(),
                fromNode: fromNode.id,
                toNode: toNode.id,
                fromSide: fromSide,
                toSide: toSide
            });
        }
    }

    return result;
}

/**
 * Process whiteboards and prepare canvas data
 */
function processWhiteboards(cardsPath) {
    // Initialize whiteboard structures
    for (let whiteboard of heptabaseData.whiteBoardList) {
        whiteboard.nodes = [];
        whiteboard.edges = [];
        whiteboard.sections = [];
    }

    // Assign card instances to whiteboards
    for (let card of heptabaseData.cardInstances) {
        const whiteboard = findWhiteboard(card.whiteboardId);
        if (whiteboard) {
            whiteboard.nodes.push(card);
        }
    }

    // Assign connections to whiteboards
    for (let connection of heptabaseData.connections) {
        const whiteboard = findWhiteboard(connection.whiteboardId);
        if (whiteboard) {
            whiteboard.edges.push(connection);
        }
    }

    // Assign sections to whiteboards
    for (let section of heptabaseData.sections) {
        const whiteboard = findWhiteboard(section.whiteboardId);
        if (whiteboard) {
            whiteboard.sections.push(section);
        }
    }

    // Create canvas data for each whiteboard
    const canvasList = [];
    for (let whiteboard of heptabaseData.whiteBoardList) {
        const canvasData = createCanvas(whiteboard, cardsPath);
        canvasList.push({
            filename: `${whiteboard.name}.canvas`,
            content: JSON.stringify(canvasData, null, 2)
        });
    }

    return canvasList;
}

/**
 * Download cards as ZIP
 */
async function downloadCards() {
    if (!heptabaseData) {
        showStatus('Please upload a file first', 'error');
        return;
    }

    try {
        showStatus('Processing cards...', 'info');

        const markdownList = processCards();

        if (markdownList.length === 0) {
            showStatus('No cards to export', 'error');
            return;
        }

        // Create ZIP file
        const zip = new JSZip();

        for (let item of markdownList) {
            zip.file(item.filename, item.content);
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, 'Cards.zip');

        showStatus(`Successfully exported ${markdownList.length} cards`, 'success');
    } catch (error) {
        showStatus(`Error creating cards ZIP: ${error.message}`, 'error');
        console.error(error);
    }
}

/**
 * Download canvas as ZIP
 */
async function downloadCanvas() {
    if (!heptabaseData) {
        showStatus('Please upload a file first', 'error');
        return;
    }

    try {
        showStatus('Processing canvas...', 'info');

        const cardsPath = cardsPathInput.value || 'Cards/';
        const canvasList = processWhiteboards(cardsPath);

        if (canvasList.length === 0) {
            showStatus('No whiteboards to export', 'error');
            return;
        }

        // Create ZIP file
        const zip = new JSZip();

        for (let item of canvasList) {
            zip.file(item.filename, item.content);
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, 'Canvas.zip');

        showStatus(`Successfully exported ${canvasList.length} canvas files`, 'success');
    } catch (error) {
        showStatus(`Error creating canvas ZIP: ${error.message}`, 'error');
        console.error(error);
    }
}

/**
 * Download blob as file
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Show status message
 */
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}
