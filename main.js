// ...MediaPipe-versionen av enableOutlineBackground finns nedan...
// Endast prickad outline med MediaPipe Selfie Segmentation
// Rutnätläge toggle (globalt)
let outlineGridMode = false;
// Sätt eventlyssnare EN gång
if (!window._outlineGridBtnInit) {
    window._outlineGridBtnInit = true;
    const outlineGridBtn = document.getElementById('outline-type-grid');
    if (outlineGridBtn) {
        outlineGridBtn.addEventListener('click', function () {
            outlineGridMode = !outlineGridMode;
            outlineGridBtn.classList.toggle('active', outlineGridMode);
        });
    }
}

async function enableOutlineBackground() {
    // Stoppa overall-animation om den körs
    if (window._overallPhosphoneStop) window._overallPhosphoneStop();
    const video = document.getElementById('video');
    const canvas = document.getElementById('output-canvas');
    const loader = document.getElementById('loader');
    loader.style.display = 'flex';
    canvas.style.display = 'none';
    video.style.display = 'block';
    // Visa outline-options
    const outlineOptions = document.getElementById('outline-options');
    if (outlineOptions) outlineOptions.style.display = 'block';

    if (video.readyState < 2) {
        await new Promise(resolve => {
            video.onloadeddata = resolve;
        });
    }

    // Initiera MediaPipe SelfieSegmentation
    const selfieSegmentation = new window.SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
    });
    selfieSegmentation.setOptions({ modelSelection: 1 });

    loader.style.display = 'none';
    canvas.style.display = 'block';
    video.style.display = 'none';

    function resizeCanvas() {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let lastOutline = [];
    let lastMask = null;

    async function processFrame() {
        if (video.paused || video.ended) return;
        await selfieSegmentation.send({ image: video });
        requestAnimationFrame(processFrame);
    }

    // Spara senaste phosphone-punkter för att minska blink
    let lastPhosphones = [];
    selfieSegmentation.onResults((results) => {
        const ctx = canvas.getContext('2d');
        // Mjuk fade till svart för att minska blink
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        if (!results.segmentationMask) return;
        // Hämta masken som ImageData (utan att rita ut masken på canvas)
        const offscreen = document.createElement('canvas');
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        const offctx = offscreen.getContext('2d');
        offctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
        const maskData = offctx.getImageData(0, 0, canvas.width, canvas.height);
        // Skapa outline från masken
        let outline = getOutlineFromMask(maskData, canvas.width, canvas.height);
        if (outline.length === 0 && lastOutline.length > 0) {
            outline = lastOutline;
        } else if (outline.length > 0) {
            lastOutline = outline;
        }
        let phosphones = [];
        if (outlineGridMode) {
            // Rutnät: 32x32
            const gridX = 32;
            const gridY = 32;
            const cellW = canvas.width / gridX;
            const cellH = canvas.height / gridY;
            for (let gx = 0; gx < gridX; gx++) {
                for (let gy = 0; gy < gridY; gy++) {
                    // Mittpunkt i cellen
                    const px = Math.floor((gx + 0.5) * cellW);
                    const py = Math.floor((gy + 0.5) * cellH);
                    // Finns kontur nära denna punkt?
                    let minDist = 9999;
                    let nearest = null;
                    for (const [ox, oy] of outline) {
                        const d = (ox-px)*(ox-px)+(oy-py)*(oy-py);
                        if (d < minDist) {
                            minDist = d;
                            nearest = [ox, oy];
                        }
                    }
                    if (nearest && Math.sqrt(minDist) < Math.max(cellW, cellH)) {
                        // Slumpa intensitet och storlek
                        const intensity = 0.7 + Math.random() * 0.3;
                        const size = 10 + Math.random() * 10;
                        phosphones.push({ x: px, y: py, intensity, size });
                    }
                }
            }
        } else {
            // Vanliga prickar längs konturen
            let dotSpacing = 15;
            const dotSpacingSlider = document.getElementById('dot-spacing-slider');
            if (dotSpacingSlider) {
                dotSpacing = parseInt(dotSpacingSlider.value, 10) || 15;
            }
            const numPhosphones = Math.floor(outline.length / dotSpacing);
            for (let i = 0; i < numPhosphones; i++) {
                const idx = i * dotSpacing;
                if (idx >= outline.length) break;
                let [x, y] = outline[idx];
                x += (Math.random() - 0.5) * 8;
                y += (Math.random() - 0.5) * 8;
                const intensity = 0.7 + Math.random() * 0.3;
                const size = 10 + Math.random() * 10;
                phosphones.push({ x, y, intensity, size });
            }
        }
        // Om inga nya, använd senaste
        if (phosphones.length === 0 && lastPhosphones.length > 0) {
            phosphones = lastPhosphones;
        } else if (phosphones.length > 0) {
            lastPhosphones = phosphones;
        }
        // Rita suddiga phosphones (gaussian glow) ENDAST på konturen
        ctx.save();
        for (const p of phosphones) {
            const r = p.size;
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            grad.addColorStop(0, `rgba(255,255,255,${p.intensity})`);
            grad.addColorStop(0.2, `rgba(200,200,200,${0.7 * p.intensity})`);
            grad.addColorStop(0.5, `rgba(120,120,120,${0.18 * p.intensity})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 0.95 * p.intensity;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
            ctx.fillStyle = grad;
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.restore();
    });
    processFrame();
}

// Hjälpfunktion för att hitta konturen från masken (MediaPipe)
function getOutlineFromMask(maskData, width, height) {
    const outline = [];
    const data = maskData.data;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = (y * width + x) * 4;
            // Vit pixel = person, svart = bakgrund
            if (data[i] > 128) {
                // Om någon granne är bakgrund, är detta en kant
                if (
                    data[i - 4] <= 128 || data[i + 4] <= 128 ||
                    data[i - width * 4] <= 128 || data[i + width * 4] <= 128
                ) {
                    outline.push([x, y]);
                }
            }
        }
    }
    return outline;
// ...slut på getOutlineFromMask...
    return window.bodyPix;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function enableRemoveBackground() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('output-canvas');
    const loader = document.getElementById('loader');
    loader.style.display = 'flex';
    canvas.style.display = 'none';
    video.style.display = 'block';

    // Vänta tills video är redo
    if (video.readyState < 2) {
        await new Promise(resolve => {
            video.onloadeddata = resolve;
        });
    }

    const bodyPix = await loadBodyPix();
    const net = await bodyPix.load();
    loader.style.display = 'none';
    canvas.style.display = 'block';
    video.style.display = 'none';

    function resizeCanvas() {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let lastSegmentation = null;
    async function drawFrame() {
        if (video.paused || video.ended) return;
        let segmentation = await net.segmentPerson(video, { internalResolution: 'medium' });
        if (segmentation.data && segmentation.data.some(v => v === 1)) {
            lastSegmentation = segmentation;
        } else if (lastSegmentation) {
            segmentation = lastSegmentation;
        }
        const ctx = canvas.getContext('2d');
        // Fyll bakgrunden med svart
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (segmentation.data[i / 4] === 0) {
                // Gör bakgrunden helt svart (RGB=0,0,0, alpha=255)
                data[i] = 0;
                data[i+1] = 0;
                data[i+2] = 0;
                data[i+3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        requestAnimationFrame(drawFrame);
    }
    drawFrame();
}

document.addEventListener('DOMContentLoaded', function () {
    const removeBgBtn = document.getElementById('remove-bg');
    if (removeBgBtn) {
        removeBgBtn.addEventListener('click', function (e) {
            e.preventDefault();
            enableRemoveBackground();
        });
    }
    const normalCamBtn = document.getElementById('normal-cam');
    if (normalCamBtn) {
        normalCamBtn.addEventListener('click', function (e) {
            e.preventDefault();
            showNormalCamera();
        });
    }
    // Overall-knapp: visa phosphone-rutnät över hela bilden
    const overallCamBtn = document.getElementById('overall-cam');
    if (overallCamBtn) {
        overallCamBtn.addEventListener('click', function (e) {
            e.preventDefault();
            enableOverallPhosphones();
        });
    }

// Phosphone-rutnät över hela bilden
async function enableOverallPhosphones() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('output-canvas');
    const loader = document.getElementById('loader');
    const outlineOptions = document.getElementById('outline-options');
    loader.style.display = 'none';
    canvas.style.display = 'block';
    video.style.display = 'none';
    if (outlineOptions) outlineOptions.style.display = 'none';

    function resizeCanvas() {
        // På mobil: tvinga 1:1 aspect och 32x32 grid över hela ytan
        if (/Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)) {
            const size = Math.min(window.innerWidth, window.innerHeight);
            canvas.width = 320;
            canvas.height = 320;
            canvas.style.width = size + 'px';
            canvas.style.height = size + 'px';
        } else {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.style.width = '100vw';
            canvas.style.height = '100vh';
        }
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let running = true;
    // Avbryt ev. tidigare animationer
    if (window._overallPhosphoneStop) window._overallPhosphoneStop();
    window._overallPhosphoneStop = () => { running = false; };

    // Throttle: rita bara varannan frame på mobil
    let skipFrame = false;
    function isMobile() {
        return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
    }
    function drawPhosphones() {
        if (!running) return;
        if (isMobile()) {
            skipFrame = !skipFrame;
            if (skipFrame) {
                requestAnimationFrame(drawPhosphones);
                return;
            }
        }
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Justerbar täthet
        let gridSize = 32;
        const dotSpacingSlider = document.getElementById('dot-spacing-slider');
        if (dotSpacingSlider) {
            gridSize = 10 + 40 - parseInt(dotSpacingSlider.value, 10); // Omvänd slider
        }
        // Sänk grid på mobil för bättre prestanda
        if (isMobile() && gridSize > 20) gridSize = 16;
        const rows = Math.round(canvas.height / (canvas.width / gridSize));
        const colStep = canvas.width / gridSize;
        const rowStep = canvas.height / rows;

        // Hämta pixeldata från videon
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < gridSize; x++) {
                // Ta pixel i mitten av rutan
                const px = Math.floor((x + 0.5) * colStep);
                const py = Math.floor((y + 0.5) * rowStep);
                const i = (py * canvas.width + px) * 4;
                const r = frame.data[i];
                const g = frame.data[i+1];
                const b = frame.data[i+2];
                // Enkel luminans
                const lum = 0.2126*r + 0.7152*g + 0.0722*b;
                // Slumpa intensitet och storlek
                const intensity = (lum/255) * (0.7 + Math.random()*0.3);
                const size = 8 + Math.random()*10;
                // Rita bara om det är tillräckligt ljust
                if (intensity > 0.08) {
                    const grad = ctx.createRadialGradient(px, py, 0, px, py, size);
                    grad.addColorStop(0, `rgba(255,255,255,${intensity})`);
                    grad.addColorStop(0.2, `rgba(200,200,200,${0.7*intensity})`);
                    grad.addColorStop(0.5, `rgba(120,120,120,${0.18*intensity})`);
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.globalAlpha = 0.95 * intensity;
                    ctx.beginPath();
                    ctx.arc(px, py, size, 0, 2 * Math.PI);
                    ctx.fillStyle = grad;
                    ctx.fill();
                }
            }
        }
        ctx.globalAlpha = 1.0;
        requestAnimationFrame(drawPhosphones);
    }
    drawPhosphones();
}

// Visa bara vanlig kamera (dölj canvas och outline-options)
function showNormalCamera() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('output-canvas');
    const outlineOptions = document.getElementById('outline-options');
    if (video) video.style.display = 'block';
    if (canvas) canvas.style.display = 'none';
    if (outlineOptions) outlineOptions.style.display = 'none';
}
    const outlineBgBtn = document.getElementById('outline-bg');
    if (outlineBgBtn) {
        outlineBgBtn.addEventListener('click', function (e) {
            e.preventDefault();
            enableOutlineBackground();
        });
    }
    // Slider för prick-avstånd
    const dotSpacingSlider = document.getElementById('dot-spacing-slider');
    const dotSpacingValue = document.getElementById('dot-spacing-value');
    if (dotSpacingSlider && dotSpacingValue) {
        dotSpacingSlider.addEventListener('input', function () {
            dotSpacingValue.textContent = dotSpacingSlider.value;
        });
    }
});
// main.js

document.addEventListener('DOMContentLoaded', function () {
    const menuBtn = document.getElementById('menu-btn');
    const menuDropdown = document.getElementById('menu-dropdown');

    menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        menuDropdown.classList.toggle('show');
    });

    document.addEventListener('click', function () {
        menuDropdown.classList.remove('show');
    });
});
