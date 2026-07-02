const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const beadsContainer = document.getElementById('beads-container');
const resultOverlay = document.getElementById('bottom-panel');
const resultSentence = document.getElementById('result-sentence');
const showAnswerBtn = document.getElementById('show-answer-btn');
const resetBtn = document.getElementById('reset-btn');
const colorToggle = document.getElementById('color-toggle');

let isDrawing = false;
let drawnPath = [];
let beads = [];
const TOTAL_BEADS = 10;
let BEAD_RADIUS = 30;
let gameAreaRect;
let appState = 'scattering'; // scattering, drawing, split
let enableColorChange = true;

function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    gameAreaRect = parent.getBoundingClientRect();
    
    const beadSizeStr = getComputedStyle(document.documentElement).getPropertyValue('--bead-size');
    const size = parseInt(beadSizeStr) || 60;
    BEAD_RADIUS = size / 2;
    
    beads.forEach(b => {
        if (b.x && b.y) b.updatePosition();
    });
}

window.addEventListener('resize', resizeCanvas);

class Bead {
    constructor(id) {
        this.id = id;
        this.el = document.createElement('div');
        this.el.classList.add('bead');
        beadsContainer.appendChild(this.el);
    }
    
    updatePosition() {
        this.el.style.left = `${this.x - BEAD_RADIUS}px`;
        this.el.style.top = `${this.y - BEAD_RADIUS}px`;
    }
    
    moveTo(targetX, targetY) {
        this.x = targetX;
        this.y = targetY;
        this.updatePosition();
    }
}

function initBeads() {
    beadsContainer.innerHTML = '';
    beads = [];
    for (let i = 0; i < TOTAL_BEADS; i++) {
        beads.push(new Bead(i));
    }
    randomizeAllBeads();
}

const themes = [
    'theme-bead', 
    'theme-block', 
    'theme-stone', 
    'theme-strawberry', 
    'theme-icecream', 
    'theme-ddakji', 
    'theme-star', 
    'theme-animal'
];
const colorPairs = ['color-pair-1', 'color-pair-2', 'color-pair-3'];

function randomizeTheme() {
    // Remove classes one by one to support older smartboard browsers that don't support multiple arguments
    themes.forEach(t => beadsContainer.classList.remove(t));
    colorPairs.forEach(c => document.body.classList.remove(c));
    
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    const randomColorPair = colorPairs[Math.floor(Math.random() * colorPairs.length)];
    
    beadsContainer.classList.add(randomTheme);
    document.body.classList.add(randomColorPair);
}

function randomizeAllBeads() {
    randomizeTheme();
    
    const padding = BEAD_RADIUS * 2;
    const minDistance = (BEAD_RADIUS * 2) + 40; // Minimum gap between beads
    
    beads.forEach((bead, i) => {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < 200) {
            attempts++;
            const x = padding + Math.random() * (canvas.width - padding * 2);
            const y = padding + Math.random() * (canvas.height - padding * 2);
            
            let collision = false;
            for (let j = 0; j < i; j++) {
                const other = beads[j];
                const dx = x - other.x;
                const dy = y - other.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                if (distance < minDistance) {
                    collision = true;
                    break;
                }
            }
            
            if (!collision) {
                bead.x = x;
                bead.y = y;
                bead.el.style.left = bead.x - BEAD_RADIUS + 'px';
                bead.el.style.top = bead.y - BEAD_RADIUS + 'px';
                placed = true;
            }
        }
        
        if (!placed) {
            bead.x = padding + Math.random() * (canvas.width - padding * 2);
            bead.y = padding + Math.random() * (canvas.height - padding * 2);
            bead.el.style.left = bead.x - BEAD_RADIUS + 'px';
            bead.el.style.top = bead.y - BEAD_RADIUS + 'px';
        }
    });
}

function startDrawing(e) {
    if (appState !== 'scattering') return;
    
    isDrawing = true;
    drawnPath = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    
    const pos = getMousePos(e);
    ctx.moveTo(pos.x, pos.y);
    drawnPath.push(pos);
    
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2ed573';
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    
    const pos = getMousePos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    drawnPath.push(pos);
}

function endDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    
    // Calculate bounding box of the drawn line to see if it's substantial
    if (drawnPath.length > 5) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        drawnPath.forEach(p => {
            if(p.x < minX) minX = p.x;
            if(p.x > maxX) maxX = p.x;
            if(p.y < minY) minY = p.y;
            if(p.y > maxY) maxY = p.y;
        });
        
        const width = maxX - minX;
        const height = maxY - minY;
        const lineLengthEstimate = Math.sqrt(width*width + height*height);
        
        if (lineLengthEstimate > 100) {
            processSplit();
            return;
        }
    }
    
    // If not a meaningful line, clear it
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function getMousePos(e) {
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    const rect = canvas.getBoundingClientRect();
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

// Math helpers
function sqr(x) { return x * x; }
function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y); }

function getClosestPointOnSegment(p, v, w) {
    const l2 = dist2(v, w);
    if (l2 === 0) return {x: v.x, y: v.y};
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
}

function rayBoxIntersection(p, v, w, h) {
    let tMin = Infinity;
    let intersect = {x: p.x, y: p.y};
    
    if (v.x < 0) {
        let t = -p.x / v.x;
        let y = p.y + t * v.y;
        if (y >= 0 && y <= h && t > 0 && t < tMin) { tMin = t; intersect = {x: 0, y: y}; }
    }
    if (v.x > 0) {
        let t = (w - p.x) / v.x;
        let y = p.y + t * v.y;
        if (y >= 0 && y <= h && t > 0 && t < tMin) { tMin = t; intersect = {x: w, y: y}; }
    }
    if (v.y < 0) {
        let t = -p.y / v.y;
        let x = p.x + t * v.x;
        if (x >= 0 && x <= w && t > 0 && t < tMin) { tMin = t; intersect = {x: x, y: 0}; }
    }
    if (v.y > 0) {
        let t = (h - p.y) / v.y;
        let x = p.x + t * v.x;
        if (x >= 0 && x <= w && t > 0 && t < tMin) { tMin = t; intersect = {x: x, y: h}; }
    }
    
    if (tMin === Infinity) {
        let dTop = p.y, dBot = h - p.y, dLeft = p.x, dRight = w - p.x;
        let m = Math.min(dTop, dBot, dLeft, dRight);
        if (m === dTop) return {x: p.x, y: 0};
        if (m === dBot) return {x: p.x, y: h};
        if (m === dLeft) return {x: 0, y: p.y};
        return {x: w, y: p.y};
    }
    return intersect;
}

function snapAndGetS(p, w, h) {
    let dTop = p.y, dBot = h - p.y, dLeft = p.x, dRight = w - p.x;
    let m = Math.min(dTop, dBot, dLeft, dRight);
    let snapped = {x: p.x, y: p.y};
    if (m === dTop) { snapped.y = 0; snapped.x = Math.max(0, Math.min(w, p.x)); return {p: snapped, s: snapped.x}; }
    if (m === dRight) { snapped.x = w; snapped.y = Math.max(0, Math.min(h, p.y)); return {p: snapped, s: w + snapped.y}; }
    if (m === dBot) { snapped.y = h; snapped.x = Math.max(0, Math.min(w, p.x)); return {p: snapped, s: w + h + (w - snapped.x)}; }
    if (m === dLeft) { snapped.x = 0; snapped.y = Math.max(0, Math.min(h, p.y)); return {p: snapped, s: 2*w + h + (h - snapped.y)}; }
    return {p: snapped, s: 0};
}

function isPointInPolygon(point, vs) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function processSplit() {
    appState = 'split';
    
    let sideACount = 0;
    let sideBCount = 0;
    let sideASumX = 0, sideASumY = 0;
    let sideBSumX = 0, sideBSumY = 0;
    
    if (drawnPath.length < 2) return;
    
    const w = canvas.width;
    const h = canvas.height;
    
    // 1. Calculate outward vectors for extending the line
    let startIdx = 0;
    let lookAhead = 1;
    while (lookAhead < drawnPath.length && dist2(drawnPath[startIdx], drawnPath[lookAhead]) < 400) lookAhead++;
    if (lookAhead >= drawnPath.length) lookAhead = drawnPath.length - 1;
    let startV = { x: drawnPath[startIdx].x - drawnPath[lookAhead].x, y: drawnPath[startIdx].y - drawnPath[lookAhead].y };
    if (startV.x === 0 && startV.y === 0) startV = {x: 0, y: -1};
    
    let endIdx = drawnPath.length - 1;
    let lookBack = endIdx - 1;
    while (lookBack >= 0 && dist2(drawnPath[endIdx], drawnPath[lookBack]) < 400) lookBack--;
    if (lookBack < 0) lookBack = 0;
    let endV = { x: drawnPath[endIdx].x - drawnPath[lookBack].x, y: drawnPath[endIdx].y - drawnPath[lookBack].y };
    if (endV.x === 0 && endV.y === 0) endV = {x: 0, y: 1};
    
    // 2. Extend start and end points to canvas edges
    let extStart = rayBoxIntersection(drawnPath[startIdx], startV, w, h);
    let extEnd = rayBoxIntersection(drawnPath[endIdx], endV, w, h);
    
    let startSnap = snapAndGetS(extStart, w, h);
    let endSnap = snapAndGetS(extEnd, w, h);
    
    // 3. Form closed polygon combining the drawn path and canvas perimeter
    let polygon = [startSnap.p, ...drawnPath, endSnap.p];
    let s_end = endSnap.s;
    let s_start = startSnap.s;
    
    let corners = [
        {s: 0, p: {x:0, y:0}},
        {s: w, p: {x:w, y:0}},
        {s: w+h, p: {x:w, y:h}},
        {s: 2*w+h, p: {x:0, y:h}},
        {s: 2*w+2*h, p: {x:0, y:0}}
    ];
    
    if (s_end <= s_start) {
        for (let c of corners) {
            if (c.s > s_end && c.s < s_start) polygon.push(c.p);
        }
    } else {
        for (let c of corners) {
            if (c.s > s_end) polygon.push(c.p);
        }
        for (let c of corners) {
            if (c.s > 0 && c.s < s_start) polygon.push(c.p);
        }
    }
    
    // 4. Test beads using robust Point-In-Polygon and push away if too close
    const PUSH_DISTANCE = BEAD_RADIUS + 15;
    
    beads.forEach(bead => {
        // Push away from line if needed
        let minDist2 = Infinity;
        let closestPoint = null;
        for (let i = 0; i < drawnPath.length - 1; i++) {
            const p1 = drawnPath[i];
            const p2 = drawnPath[i+1];
            const cPoint = getClosestPointOnSegment(bead, p1, p2);
            const d2 = dist2(bead, cPoint);
            if (d2 < minDist2) {
                minDist2 = d2;
                closestPoint = cPoint;
            }
        }
        
        if (minDist2 < sqr(PUSH_DISTANCE)) {
            const dist = Math.sqrt(minDist2);
            const pushAmount = PUSH_DISTANCE - dist;
            let pushX = bead.x - closestPoint.x;
            let pushY = bead.y - closestPoint.y;
            
            if (pushX === 0 && pushY === 0) {
                pushX = Math.random() - 0.5;
                pushY = Math.random() - 0.5;
            }
            const len = Math.sqrt(pushX*pushX + pushY*pushY);
            bead.x += (pushX / len) * pushAmount;
            bead.y += (pushY / len) * pushAmount;
            bead.el.style.left = bead.x - BEAD_RADIUS + 'px';
            bead.el.style.top = bead.y - BEAD_RADIUS + 'px';
        }
        
        let isInside = isPointInPolygon(bead, polygon);
        
        if (isInside) {
            bead.tempSide = 'A';
            sideACount++;
            sideASumX += bead.x;
            sideASumY += bead.y;
        } else {
            bead.tempSide = 'B';
            sideBCount++;
            sideBSumX += bead.x;
            sideBSumY += bead.y;
        }
    });
    
    // Determine which side is "Left" or "Top" based on average position
    let avgAX = sideACount > 0 ? sideASumX / sideACount : 0;
    let avgAY = sideACount > 0 ? sideASumY / sideACount : 0;
    let avgBX = sideBCount > 0 ? sideBSumX / sideBCount : 0;
    let avgBY = sideBCount > 0 ? sideBSumY / sideBCount : 0;
    
    let aIsFirst = true;
    if (Math.abs(avgAX - avgBX) > Math.abs(avgAY - avgBY)) {
        // Separated mostly horizontally
        aIsFirst = avgAX < avgBX;
    } else {
        // Separated mostly vertically
        aIsFirst = avgAY < avgBY;
    }
    
    let group1Count = 0;
    let group2Count = 0;
    
    beads.forEach(bead => {
        if ((bead.tempSide === 'A' && aIsFirst) || (bead.tempSide === 'B' && !aIsFirst)) {
            if (enableColorChange) bead.el.classList.add('group-1');
            group1Count++;
            bead.group = 1;
        } else {
            if (enableColorChange) bead.el.classList.add('group-2');
            group2Count++;
            bead.group = 2;
        }
    });
    
    setTimeout(() => {
        showResults(group1Count, group2Count);
    }, 500);
}

function getPostposition(num, type) {
    if (type === '과와') {
        // '과'를 쓰는 경우: 받침이 있는 숫자 (0, 1, 3, 6, 7, 8, 10)
        const hasJongseong = [0, 1, 3, 6, 7, 8, 10].includes(num);
        return hasJongseong ? '과' : '와';
    } else if (type === '으로로') {
        // '으로'를 쓰는 경우: 'ㄹ'을 제외한 받침이 있는 숫자 (0, 3, 6, 10)
        // '로'를 쓰는 경우: 받침이 없거나 'ㄹ' 받침인 숫자 (1, 2, 4, 5, 7, 8, 9)
        const usesEuro = [0, 3, 6, 10].includes(num);
        return usesEuro ? '으로' : '로';
    }
    return '';
}

function showResults(g1, g2) {
    const post1 = getPostposition(g1, '과와');
    const post2 = getPostposition(g2, '으로로');
    
    resultSentence.innerHTML = `10은 <span class="text-color-1">${g1}</span>${post1} <span class="text-color-2">${g2}</span>${post2} 가르기할 수 있습니다.`;
    
    // Reset visibility states for a new result
    resultSentence.style.visibility = 'hidden';
    showAnswerBtn.style.display = 'inline-block';
    
    resultOverlay.classList.remove('hidden-panel');
}

function resetGame() {
    appState = 'scattering';
    resultOverlay.classList.add('hidden-panel');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Hide sentence and prepare show answer button for next round
    resultSentence.style.visibility = 'hidden';
    showAnswerBtn.style.display = 'inline-block';
    
    beads.forEach(bead => {
        bead.el.classList.remove('group-1');
        bead.el.classList.remove('group-2');
        bead.el.style.transform = ''; // reset scale
    });
    
    randomizeAllBeads();
}

// Event Listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', endDrawing);
canvas.addEventListener('mouseout', endDrawing);

canvas.addEventListener('touchstart', startDrawing, {passive: false});
canvas.addEventListener('touchmove', draw, {passive: false});
canvas.addEventListener('touchend', endDrawing);
canvas.addEventListener('touchcancel', endDrawing);

resetBtn.addEventListener('click', resetGame);
showAnswerBtn.addEventListener('click', () => {
    resultSentence.style.visibility = 'visible';
    showAnswerBtn.style.display = 'none';
});

colorToggle.addEventListener('change', (e) => {
    enableColorChange = e.target.checked;
    
    if (appState === 'split') {
        beads.forEach(bead => {
            if (enableColorChange) {
                if (bead.group === 1) bead.el.classList.add('group-1');
                if (bead.group === 2) bead.el.classList.add('group-2');
            } else {
                bead.el.classList.remove('group-1');
                bead.el.classList.remove('group-2');
            }
        });
    }
});

// Initialization
window.onload = () => {
    // Slight delay to ensure parent dimensions are computed
    setTimeout(() => {
        resizeCanvas();
        initBeads();
    }, 100);
};

// Prevent right-click context menu (especially useful for smartboards/touch screens)
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});
