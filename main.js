// ...MediaPipe-versionen av enableOutlineBackground finns nedan...
// Endast prickad outline med MediaPipe Selfie Segmentation
async function enableOutlineBackground() {
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
        // Välj ut phosphone-punkter
        let dotSpacing = 15;
        const dotSpacingSlider = document.getElementById('dot-spacing-slider');
        if (dotSpacingSlider) {
            dotSpacing = parseInt(dotSpacingSlider.value, 10) || 15;
        }
        const numPhosphones = Math.floor(outline.length / dotSpacing);
        let phosphones = [];
        for (let i = 0; i < numPhosphones; i++) {
            const idx = i * dotSpacing;
            if (idx >= outline.length) break;
            let [x, y] = outline[idx];
            // Lägg till lite slump för att simulera "jitter" i stimuleringen
            x += (Math.random() - 0.5) * 8;
            y += (Math.random() - 0.5) * 8;
            phosphones.push({ x, y });
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
            const r = 14;
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.2, 'rgba(255,255,200,0.7)');
            grad.addColorStop(0.5, 'rgba(255,255,180,0.25)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 0.95;
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
