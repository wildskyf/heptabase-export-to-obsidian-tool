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
 * Sanitize filename by replacing illegal characters
 */
function sanitizeFilename(filename) {
    // Replace illegal filesystem characters with safe alternatives
    const replacements = {
        '/': '÷',
        '\\': '⧵',
        ':': '∶',
        '*': '✱',
        '?': '？',
        '"': '"',
        '<': '‹',
        '>': '›',
        '|': '｜'
    };

    let sanitized = filename;
    for (const [char, replacement] of Object.entries(replacements)) {
        sanitized = sanitized.replace(new RegExp('\\' + char, 'g'), replacement);
    }

    // Trim whitespace and limit length
    sanitized = sanitized.trim();
    if (sanitized.length > 200) {
        sanitized = sanitized.substring(0, 200);
    }

    return sanitized || 'Untitled';
}

/**
 * Convert ProseMirror JSON to Markdown
 */
function prosemirrorToMarkdown(content) {
    // If content is null or undefined, return empty string
    if (!content) {
        return '';
    }

    // If content is a string, try to parse it as JSON
    if (typeof content === 'string') {
        try {
            content = JSON.parse(content);
        } catch (e) {
            // If parsing fails, return the string as-is
            console.warn('Failed to parse content as JSON:', e);
            return content;
        }
    }

    // Process ProseMirror document
    if (content.type === 'doc' && content.content) {
        return content.content.map(node => processNode(node)).join('\n\n');
    }

    return '';
}

/**
 * Process a single ProseMirror node
 */
function processNode(node) {
    if (!node) return '';

    switch (node.type) {
        case 'heading':
            const level = node.attrs?.level || 1;
            const headingText = processInlineContent(node.content);
            return '#'.repeat(level) + ' ' + headingText;

        case 'paragraph':
            return processInlineContent(node.content);

        case 'bulletList':
            return node.content?.map(item => processBulletItem(item)).join('\n') || '';

        case 'orderedList':
            return node.content?.map((item, index) => processOrderedItem(item, index + 1)).join('\n') || '';

        case 'listItem':
            return processInlineContent(node.content);

        // Heptabase-specific: bullet_list_item as direct node type
        case 'bullet_list_item':
            if (!node.content) return '';
            const bulletContent = node.content.map(n => {
                if (n.type === 'paragraph') {
                    return processInlineContent(n.content);
                }
                return processNode(n);
            }).join('\n  ');
            return '- ' + bulletContent;

        // Heptabase-specific: ordered_list_item as direct node type
        case 'ordered_list_item':
            if (!node.content) return '';
            const orderedContent = node.content.map(n => {
                if (n.type === 'paragraph') {
                    return processInlineContent(n.content);
                }
                return processNode(n);
            }).join('\n  ');
            // Without context of list position, default to 1
            return '1. ' + orderedContent;

        case 'codeBlock':
        case 'code_block':
            // Heptabase uses 'params' instead of 'language'
            const language = node.attrs?.params || node.attrs?.language || '';
            const code = processInlineContent(node.content);
            return '```' + language + '\n' + code + '\n```';

        case 'blockquote':
            const quoteContent = node.content?.map(n => processNode(n)).join('\n') || '';
            return quoteContent.split('\n').map(line => '> ' + line).join('\n');

        case 'horizontalRule':
        case 'horizontal_rule':
            return '---';

        case 'hardBreak':
        case 'hard_break':
            return '  \n';

        case 'image':
            const src = node.attrs?.src || '';
            const alt = node.attrs?.alt || '';
            const title = node.attrs?.title || '';
            return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;

        // Math formulas
        case 'math_display':
            const displayMath = processInlineContent(node.content);
            return '$$\n' + displayMath + '\n$$';

        case 'math_inline':
            const inlineMath = processInlineContent(node.content);
            return '$' + inlineMath + '$';

        // Toggle list (treat as bullet list)
        case 'toggle_list_item':
            if (!node.content) return '';
            const toggleContent = node.content.map(n => {
                if (n.type === 'paragraph') {
                    return processInlineContent(n.content);
                }
                return processNode(n);
            }).join('\n  ');
            return '- ' + toggleContent;

        // Tables
        case 'table':
            if (!node.content) return '';
            const rows = node.content.map(row => processNode(row));
            // Add separator after header
            if (rows.length > 0) {
                const headerCells = node.content[0]?.content?.length || 1;
                const separator = '| ' + Array(headerCells).fill('---').join(' | ') + ' |';
                rows.splice(1, 0, separator);
            }
            return rows.join('\n');

        case 'table_row':
            if (!node.content) return '';
            const cells = node.content.map(cell => processNode(cell));
            return '| ' + cells.join(' | ') + ' |';

        case 'table_header':
        case 'table_cell':
            return processInlineContent(node.content);

        // Card reference (embedded card)
        case 'card':
            const cardId = node.attrs?.cardId;
            if (cardId) {
                const referencedCard = findCard(cardId);
                if (referencedCard) {
                    return `[[${referencedCard.title}]]`;
                }
            }
            return '';

        // PDF card
        case 'pdf_card':
            const pdfTitle = node.attrs?.title || 'PDF Document';
            return `[${pdfTitle}]`;

        // Embed
        case 'embed':
            const embedUrl = node.attrs?.src || node.attrs?.url || '';
            return embedUrl ? `[Embedded content](${embedUrl})` : '[Embedded content]';

        // Section (treat as heading)
        case 'section':
            if (!node.content) return '';
            return node.content.map(n => processNode(n)).join('\n\n');

        default:
            // For unknown types, try to process content if it exists
            if (node.content) {
                return node.content.map(n => processNode(n)).join('');
            }
            return '';
    }
}

/**
 * Process bullet list item
 */
function processBulletItem(item) {
    if (!item || !item.content) return '';

    const content = item.content.map(node => {
        if (node.type === 'paragraph') {
            return processInlineContent(node.content);
        }
        return processNode(node);
    }).join('\n  ');

    return '- ' + content;
}

/**
 * Process ordered list item
 */
function processOrderedItem(item, number) {
    if (!item || !item.content) return '';

    const content = item.content.map(node => {
        if (node.type === 'paragraph') {
            return processInlineContent(node.content);
        }
        return processNode(node);
    }).join('\n  ');

    return `${number}. ${content}`;
}

/**
 * Process inline content (text with marks)
 */
function processInlineContent(content) {
    if (!content || !Array.isArray(content)) {
        return '';
    }

    return content.map(node => {
        if (node.type === 'text') {
            let text = node.text || '';

            // Apply marks (formatting)
            if (node.marks && node.marks.length > 0) {
                for (const mark of node.marks) {
                    switch (mark.type) {
                        case 'bold':
                        case 'strong':
                            text = `**${text}**`;
                            break;
                        case 'italic':
                        case 'em':
                            text = `*${text}*`;
                            break;
                        case 'code':
                            text = `\`${text}\``;
                            break;
                        case 'strike':
                            text = `~~${text}~~`;
                            break;
                        case 'link':
                            const href = mark.attrs?.href || '';
                            text = `[${text}](${href})`;
                            break;
                        case 'underline':
                            // Markdown doesn't have native underline, use HTML
                            text = `<u>${text}</u>`;
                            break;
                        case 'color':
                            // Handle text color or background color
                            const colorType = mark.attrs?.type;
                            const color = mark.attrs?.color;
                            if (colorType === 'background' && color) {
                                // Use HTML mark tag for highlighting
                                text = `<mark style="background-color: ${color}">${text}</mark>`;
                            } else if (color) {
                                text = `<span style="color: ${color}">${text}</span>`;
                            }
                            break;
                        case 'highlight_element':
                            // Simple highlight
                            text = `==${text}==`;
                            break;
                        case 'date':
                            // Keep date as-is, possibly with formatting
                            break;
                    }
                }
            }

            return text;
        } else if (node.type === 'hardBreak') {
            return '  \n';
        } else {
            // Handle other inline node types
            return processNode(node);
        }
    }).join('');
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

        // Skip empty titles
        if (!card.title || card.title.trim() === '') {
            continue;
        }

        // Convert ProseMirror JSON to Markdown
        let content = prosemirrorToMarkdown(card.content);

        // Replace card references with wiki links
        const matches = content.matchAll(pattern);

        for (let match of matches) {
            const uid = match[1];
            const referencedCard = findCard(uid);
            if (referencedCard) {
                const link = `[[${referencedCard.title}]]`;
                content = content.replace(`{{card ${uid}}}`, link);
            }
        }

        // Sanitize filename
        const safeTitle = sanitizeFilename(card.title);

        markdownList.push({
            filename: `${safeTitle}.md`,
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

        // Use sanitized filename
        const safeTitle = sanitizeFilename(card.title);

        result.nodes.push({
            id: generateId(),
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height - 30,
            type: 'file',
            file: `${cardsPath}${safeTitle}.md`
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
