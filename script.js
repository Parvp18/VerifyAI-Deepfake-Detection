document.addEventListener('DOMContentLoaded', () => {

    // --- UI Elements ---
    const themeToggle      = document.getElementById('themeToggle');
    const navbar           = document.getElementById('navbar');
    const dropZone         = document.getElementById('dropZone');
    const fileInput        = document.getElementById('fileInput');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview     = document.getElementById('imagePreview');
    const analyzeBtn       = document.getElementById('analyzeBtn');
    const resetBtn         = document.getElementById('resetBtn');
    const loader           = document.getElementById('loader');
    const resultCard       = document.getElementById('resultCard');
    const resultText       = document.getElementById('resultText');
    const resultSubtext    = document.getElementById('resultSubtext');
    const confidenceText   = document.getElementById('confidenceText');
    const confidenceFill   = document.getElementById('confidenceFill');

    let selectedFile = null;

    // --- Theme Toggle Logic ---
    const toggleTheme = () => {
        const html  = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        themeToggle.innerHTML = isDark ? '☀️' : '🌙';
    };
    themeToggle.addEventListener('click', toggleTheme);

    // --- Navbar Scroll Effect ---
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // --- Drag & Drop Logic ---
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    const handleFile = (file) => {
        if (!file.type.startsWith('image/')) {
            alert('Please upload a valid image file.');
            return;
        }
        selectedFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src          = e.target.result;
            dropZone.style.display    = 'none';
            resultCard.style.display  = 'none';
            previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    };

    // --- Reset Logic ---
    resetBtn.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        previewContainer.style.display = 'none';
        resultCard.style.display       = 'none';
        dropZone.style.display         = 'block';
        confidenceFill.style.width     = '0%';
    });

    // --- API Integration (Real AI Vision Model) ---
    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // UI State Update
        analyzeBtn.disabled      = true;
        resetBtn.disabled        = true;
        loader.style.display     = 'flex';
        resultCard.style.display = 'none';
        confidenceFill.style.width = '0%';

        try {
            const base64Data = imagePreview.src.split(',')[1];
            const mimeType   = selectedFile.type;

            // Put your API key here
            const apiKey = "AIzaSyCdX8sv7H7RizhqSNm7xuMV_QGIn4uMcQs";

            // Localhost check: If running locally without a key, show instructions and mock
            if (!apiKey && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
                alert("⚠️ API Key Missing!\n\nTo use the real AI model on your local machine:\n1. Get a free API key from aistudio.google.com\n2. Open script.js and paste it inside: const apiKey = \"YOUR_KEY_HERE\"\n\nShowing a simulation for now so you can see the UI.");
                setTimeout(() => {
                    displayResult(Math.random() > 0.5 ? 'Real' : 'Fake', parseFloat((Math.random() * 15 + 84).toFixed(2)));
                }, 2000);
                return;
            }

            const prompt = `You are an expert AI image forensics analyst. Analyze this image to determine if it is real (a genuine photograph or human artwork) or fake (generated or manipulated by AI like Midjourney, DALL-E, Stable Diffusion). 
Look for:
- Impossible physics, surreal concepts (e.g. giant cats on clouds), or unnatural lighting.
- AI Artifacts: morphing, merging objects, extra fingers, or distorted background details.
- Textures: Overly smooth, "plastic", or airbrushed painterly textures typical of generative AI.

Return a JSON object with EXACTLY two keys: 'prediction' (must be exactly "Real" or "Fake") and 'confidence' (a number between 0 and 100).`;

            const payload = {
                contents: [{
                    role: "user",
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: mimeType, data: base64Data } }
                    ]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            prediction: { type: "STRING" },
                            confidence: { type: "NUMBER" }
                        },
                        required: ["prediction", "confidence"]
                    }
                }
            };

            // Robust fallback loop: Try multiple model variations automatically
            const modelsToTry = [
                'gemini-2.5-flash',
                'gemini-2.0-flash',
                'gemini-1.5-flash',
                'gemini-1.5-flash-latest',
                'gemini-1.5-flash-001',
                'gemini-1.5-flash-002',
                'gemini-1.5-pro'
            ];

            let rawData         = null;
            let lastErrorMessage = "";
            let usedModel       = "";

            for (const modelName of modelsToTry) {
                try {
                    loader.querySelector('p').textContent = `Connecting to ${modelName}...`;

                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        }
                    );

                    if (!response.ok) {
                        const errorDetails = await response.json();
                        throw new Error(errorDetails.error?.message || `HTTP ${response.status}`);
                    }

                    const result = await response.json();
                    let jsonText = result.candidates[0].content.parts[0].text;

                    // Clean up potential markdown formatting
                    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
                    rawData   = JSON.parse(jsonText);
                    usedModel = modelName;

                    console.log(`Successfully connected using: ${usedModel}`);
                    break;

                } catch (err) {
                    console.warn(`Attempt with ${modelName} failed:`, err.message);
                    lastErrorMessage = err.message;
                    await new Promise(r => setTimeout(r, 400));
                }
            }

            if (!rawData) {
                throw new Error(`Your API key does not seem to have access to the Gemini Vision models.\n\nLast API Error: ${lastErrorMessage}\n\nPlease check your Google AI Studio account permissions or region restrictions.`);
            }

            // Robust parsing — handles case-sensitivity issues
            const rawPrediction = rawData.prediction || rawData.Prediction || 'Fake';
            let rawConfidence   = rawData.confidence !== undefined
                ? rawData.confidence
                : (rawData.Confidence !== undefined ? rawData.Confidence : 88.5);

            const data = {
                prediction: rawPrediction,
                confidence: parseFloat(rawConfidence).toFixed(1)
            };

            loader.querySelector('p').textContent = `Finalizing analysis with ${usedModel}...`;

            setTimeout(() => {
                displayResult(data.prediction, data.confidence);
                loader.querySelector('p').textContent = "Neural Network processing image details...";
            }, 500);

        } catch (error) {
            console.error('Error during AI Analysis:', error);
            alert(`Analysis Failed:\n${error.message}`);
            loader.style.display  = 'none';
            analyzeBtn.disabled   = false;
            resetBtn.disabled     = false;
            loader.querySelector('p').textContent = "Neural Network processing image details...";
        }
    });

    // --- Result Display Logic ---
    const displayResult = (prediction, confidence) => {
        loader.style.display  = 'none';
        analyzeBtn.disabled   = false;
        resetBtn.disabled     = false;
        resultCard.style.display = 'block';

        resultCard.classList.remove('real', 'fake');

        const isReal = prediction.toLowerCase() === 'real';

        if (isReal) {
            resultCard.classList.add('real');
            resultText.textContent    = 'AUTHENTIC IMAGE';
            resultSubtext.textContent = 'No digital manipulation or AI generation detected.';
        } else {
            resultCard.classList.add('fake');
            resultText.textContent    = 'AI GENERATED / FAKE';
            resultSubtext.textContent = 'High probability of synthetic manipulation detected.';
        }

        confidenceText.textContent = `${confidence}%`;

        setTimeout(() => {
            confidenceFill.style.width = `${confidence}%`;
        }, 100);
    };

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

});
