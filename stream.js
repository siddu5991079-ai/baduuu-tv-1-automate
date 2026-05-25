const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const { spawn, execSync } = require('child_process');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

// 🚀 Multi-Stream Key Manager
const STREAM_KEYS = {
    '1'   : '15254238731883_15281627925099_najspfkgne', 
    '1.1' : '15254260751979_15281671637611_2plrcfqzze', 
    '1.2' : '15254285524587_15281717840491_7e6qdknzsu',
    
    '2'   : '15254299352683_15281743071851_7dvz3h5d7q',
    '2.1' : '15254308986475_15281761618539_3xca7oij3u',
    '2.2' : '15254328122987_15281795566187_zjqa6bqzoq', 

    '3'   : '15254341885547_15281821059691_hhlpb5vicy', 
    '3.1' : '15254357089899_15281848322667_sxeexgvzl4', 
    '3.2' : '15254367510123_15281868180075_pc4jrytfgm',

    '4'   : '15255022345835_15283095800427_vwrupxzstm', 
    '4.1' : '15255038074475_15283122080363_ai5qqp2we4', 
    '4.2' : '15255045480043_15283135842923_tldl4bhmii',
    '4.3' : '15255208599147_15283449629291_abltofuc7m', 
    '4.4' : '15255217708651_15283466603115_bojrrqtlmu', 
    '4.5' : '15255227670123_15283486263915_jpntt54mve',

    '5'   : '15273689226859_15317451606635_d7zzy3c7qi', 
    '5.1' : '15273713933931_15317494860395_avj47smmim', 
    '5.2' : '15273722257003_15317510195819_6edjluvdqi',
    '5.3' : '15273739624043_15317541653099_ii4bxpvabe',
    '5.4' : '15273750175339_15317561707115_csel26ku5a', 
    '5.5' : '15273760071275_15317579467371_cnewcj54me',
    '5.6' : '15273767935595_15317595851371_3q43tk7tvm', 
    '5.7' : '15273778683499_15317616560747_4piekvs4wu',

    's1.1'  : '14204232736303_14846150314543_37jq4ryehq',
    's1.2'  : '14204288179759_14846247373359_tnsknmapva',
    's1.3'  : '14204319768111_14846302489135_sr4ht4ccwq',
    's1.4'  : '14204331957807_14846326147631_dji2acqcze',
    's1.5'  : '14204346572335_14846351641135_7gvns4o5ue',
    's1.6'  : '14204361252399_14846376479279_cjajhf4d3y',
    's1.7'  : '14204370492975_14846393649711_6fduhdqite',
    's1.8'  : '14204395527727_14846438017583_s2jlti7lsm',
    's1.9'  : '14204411387439_14846464887343_f5lxgcqj5y',
    's1.10' : '14204424691247_14846487562799_xmbvntt6wa',

    's2.1'  : '14204490948143_14846603495983_kzevn36tii',
    's2.2'  : '14204506742319_14846634494511_ta2rxyg2oy',
    's2.3'  : '14204523322927_14846661233199_foqb3q7zb4',
    's2.4'  : '14204540034607_14846689085999_gjejdie4uy',
    's2.5'  : '14204555304495_14846715497007_zdanghuxzu',
    's2.6'  : '14204565200431_14846734371375_ap3bqpabpu',
    's2.7'  : '14204577259055_14846756194863_3ecad2535u',
    's2.8'  : '14204592528943_14846785227311_4hjl46y62e',
    's2.9'  : '14204602621487_14846802594351_ilnp6lxekq',
    's2.10' : '14206184136239_14849618610735_ihnbx7hkoi'
};

const TARGET_URL = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
const SELECTED_CHANNEL = process.env.OKRU_STREAM_ID || '1';
const SERVER_SELECTION = process.env.SERVER_SELECTION || 'None'; 
const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];
const RTMP_DESTINATION = `rtmp://vsu.okcdn.ru/input/${ACTIVE_STREAM_KEY}`;

let browser = null;
let ffmpegProcess = null;

// Global variables for frozen check
let lastVideoTime = -1;
let frozenCheckTimestamp = Date.now();
const FROZEN_THRESHOLD_MS = 60000; // 1 minute allowed frozen (for buffer) before restart

// 📸 Screenshot System Setup
if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
let pendingScreenshots = [];
let uploadCycleCount = 0;

async function takeAndBatchScreenshot(page, stepName) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = `./screenshots/snap_${timestamp}_${stepName}.png`;
        await page.screenshot({ path: filePath });
        console.log(`[📸] Screenshot saved: ${filePath}`);
        pendingScreenshots.push(filePath);

        if (pendingScreenshots.length >= 3) {
            console.log(`[🚀] 3 Screenshots collected. Triggering LIVE batch upload to GitHub Releases...`);
            try {
                const tag = 'live-stream-logs';
                
                try {
                    execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Broadcast Logs" -n "Auto updated live stream status."`, { stdio: 'ignore' });
                } catch(e) {}

                try {
                    console.log(`[*] Cleaning up old images from GitHub release...`);
                    const oldAssets = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim().split('\n');
                    for (const asset of oldAssets) {
                        if (asset) execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
                    }
                } catch(e) {
                    console.log(`[-] Could not clean old assets (maybe none exist yet).`);
                }

                const fileList = pendingScreenshots.join(' ');
                execSync(`gh release upload ${tag} ${fileList} --clobber`, { stdio: 'ignore' });
                
                uploadCycleCount++;
                console.log(`[+] Live batch upload successful! (Total Cycles: ${uploadCycleCount}) Aap ab Github Release check kar sakte hain.`);
                pendingScreenshots = []; 
            } catch (err) {
                console.log(`[-] Live upload failed: ${err.message}`);
            }
        }
    } catch (e) {
        console.log(`[!] Screenshot error: ${e.message}`);
    }
}

// =========================================================================
// 🔄 MAIN LOOP
// =========================================================================
async function mainLoop() {
    while (true) {
        try {
            await startDirectStreaming();
        } catch (error) {
            console.error(`\n[!] ALERT: ${error.message}`);
            console.log('[*] 🔄 Restarting everything in 3 seconds...');
            await cleanup();
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

async function startDirectStreaming() {
    console.log(`[*] Starting browser and FFmpeg...`);
    const streamQuality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
    
    browser = await puppeteer.launch({
        headless: false, 
        defaultViewport: { width: 1280, height: 720 },
        ignoreDefaultArgs: ['--enable-automation'], 
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--window-size=1280,720', '--kiosk', 
            '--autoplay-policy=no-user-gesture-required'
        ]
    });

    const page = await browser.newPage();
    const pages = await browser.pages();
    for (const p of pages) { if (p !== page) await p.close(); }

    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            try {
                const newPage = await target.page();
                if (newPage && newPage !== page) {
                    console.log(`[!] Ad Popup detected and KILLED! Focus maintained.`);
                    await page.bringToFront(); 
                    await newPage.close();
                }
            } catch (e) {}
        }
    });

    console.log(`[*] Navigating to: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await takeAndBatchScreenshot(page, 'after-load');

    const recorder = new PuppeteerScreenRecorder(page, { followNewTab: false, fps: 30, videoFrame: { width: 1280, height: 720 } });
    console.log('[*] 🔴 Debug Recording Started...');
    await recorder.start('./recording.mp4');
    await new Promise(r => setTimeout(r, 2000));

    if (SERVER_SELECTION !== 'None') {
        console.log(`\n[*] =====================================`);
        console.log(`[*] Target Server specified: ${SERVER_SELECTION}`);
        console.log(`[*] Starting hunting & clicking loop...`);
        let serverClicked = false;
        let serverAttempts = 0;

        while (!serverClicked && serverAttempts < 10) { 
            serverAttempts++;
            try {
                const clickSuccess = await page.evaluate((serverName) => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const targetBtn = buttons.find(b => b.innerText && b.innerText.trim().includes(serverName));
                    if (targetBtn) {
                        targetBtn.click();
                        return true;
                    }
                    return false;
                }, SERVER_SELECTION);

                if (clickSuccess) {
                    console.log(`[+] SUCCESS: Found '${SERVER_SELECTION}' button (Attempt ${serverAttempts}) and clicked it!`);
                    serverClicked = true;
                    await takeAndBatchScreenshot(page, `server-clicked-${serverAttempts}`);
                    await new Promise(r => setTimeout(r, 3000)); 
                    await page.bringToFront(); 
                } else {
                    console.log(`[-] Attempt ${serverAttempts}: '${SERVER_SELECTION}' button abhi tak nahi dikha...`);
                    await takeAndBatchScreenshot(page, `server-search-${serverAttempts}`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            } catch (err) {
                console.log(`[!] Error scanning/clicking server button: ${err.message}`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        
        if (!serverClicked) {
            console.log(`[!] RESULT: '${SERVER_SELECTION}' nahi mila 10 attempts ke baad. Script agay barh rahi hai...`);
        }
        console.log(`[*] =====================================\n`);
    }

    console.log('[*] Hunting for the Play Button (Supporting both JW Player and Plyr)...');
    let buttonGone = false;
    let attempts = 0;
    
    while (!buttonGone && attempts < 15) {
        buttonGone = true;
        for (const frame of page.frames()) {
            try {
                const playBtn = await frame.$('.jw-icon-display[aria-label="Play"], button[data-plyr="play"]');
                if (playBtn) {
                    const isVisible = await frame.evaluate(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                    }, playBtn);

                    if (isVisible) {
                        buttonGone = false;
                        console.log(`[*] Play button detected! Smashing it... (Attempt ${attempts + 1}/15)`);
                        await frame.evaluate(el => el.click(), playBtn); 
                        await takeAndBatchScreenshot(page, `play-btn-clicked`);
                        await new Promise(r => setTimeout(r, 2000));
                        break; 
                    }
                }
            } catch (err) {}
        }
        attempts++;
        if (!buttonGone) await new Promise(r => setTimeout(r, 1000));
    }

    console.log('[*] Scanning iframes for the REAL Live Stream Video...');
    let targetFrame = null;
    for (const frame of page.frames()) {
        try {
            const isRealLiveStream = await frame.evaluate(() => {
                const vid = document.querySelector('video');
                if (!vid) return false;
                if (vid.clientWidth < 100 || vid.clientHeight < 100) return false; 
                return true; 
            });

            if (isRealLiveStream) {
                targetFrame = frame;
                console.log(`[+] Smart Scanner locked onto video frame: ${frame.url().substring(0, 50)}...`);
                break;
            }
        } catch (e) { }
    }

    if (!targetFrame) {
        console.log('[-] Smart Scanner could not find an iframe with video, defaulting to main page.');
        targetFrame = page.mainFrame();
    }
    await takeAndBatchScreenshot(page, 'video-located');

    console.log('[*] Enforcing Black Background and Full Screen UI...');
    await page.evaluate(() => {
        document.body.style.backgroundColor = 'black';
        document.body.style.overflow = 'hidden';
        document.querySelectorAll('iframe').forEach(iframe => {
            iframe.style.position = 'fixed'; iframe.style.top = '0'; iframe.style.left = '0';
            iframe.style.width = '100vw'; iframe.style.height = '100vh';
            iframe.style.zIndex = '999999'; iframe.style.backgroundColor = 'black'; iframe.style.border = 'none';
        });
    }).catch(() => {});

    await targetFrame.evaluate(async () => {
        const style = document.createElement('style');
        style.innerHTML = `.jw-controls, .jw-ui, .plyr__controls, .vjs-control-bar, [data-player] .controls { display: none !important; }`;
        document.head.appendChild(style);

        const video = document.querySelector('video');
        if (video) { 
            video.muted = false; video.volume = 1.0; 
            video.style.position = 'fixed'; video.style.top = '0'; video.style.left = '0';
            video.style.width = '100vw'; video.style.height = '100vh';
            video.style.zIndex = '2147483647'; video.style.backgroundColor = 'black'; video.style.objectFit = 'contain';
        }
    }).catch(()=>{});

    console.log(`[+] Broadcasting to OK.ru CHANNEL: ${SELECTED_CHANNEL} - Quality: ${streamQuality}`);
    
    let vfScale, bv, maxrate, bufsize, ba;

    if (streamQuality.includes('50KBps')) {
        vfScale = 'scale=640:360';
        bv = '350k'; maxrate = '400k'; bufsize = '800k'; ba = '32k';
    } else if (streamQuality.includes('30KBps')) {
        vfScale = 'scale=426:240';
        bv = '200k'; maxrate = '220k'; bufsize = '440k'; ba = '32k';
    } else {
        vfScale = 'scale=854:480';
        bv = '800k'; maxrate = '850k'; bufsize = '1700k'; ba = '64k';
    }

    const displayNum = process.env.DISPLAY || ':99';
    let ffmpegArgs = [
        '-y', 
        
        // Video Input (Screen)
        '-thread_queue_size', '5120', 
        '-f', 'x11grab', '-draw_mouse', '0', '-video_size', '1280x720', '-framerate', '30',
        '-i', displayNum, 
        
        // Audio Input (Pulse)
        '-thread_queue_size', '5120', 
        '-f', 'pulse', '-i', 'default',
        
        '-filter_complex', '[0:v]setpts=PTS-STARTPTS[v];[1:a]asetpts=PTS-STARTPTS,aresample=async=1[a]',
        '-map', '[v]', '-map', '[a]',
        
        // Encoding Settings
        '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main',
        '-b:v', bv, '-maxrate', maxrate, '-bufsize', bufsize,
        '-pix_fmt', 'yuv420p', '-g', '60', 
        '-c:a', 'aac', '-b:a', ba, '-ac', '2', '-ar', '44100',
        
        '-f', 'flv', RTMP_DESTINATION 
    ];
    
    ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    ffmpegProcess.stderr.on('data', (data) => {
        if (data.toString().includes('Error')) console.log(`[FFmpeg Error]: ${data}`);
    });

    console.log('[*] Capturing stream for 30 seconds to finalize Debug Recording...');
    await new Promise(r => setTimeout(r, 30000));
    await recorder.stop();
    console.log('[+] 30-Sec Debug Video Saved! Safe to cancel workflow anytime now.');
    await takeAndBatchScreenshot(page, 'recording-finished');

    console.log('\n[*] Smart Engine Connected! 24/7 Monitoring Active...');
    let watchdogTicks = 0;
    while (true) {
        if (!browser || !browser.isConnected()) throw new Error("Browser closed.");

        let overallStatus = 'DEAD';
        let currentVideoTime = -1; 
        let criticalErrorFound = false;

        for (const frame of page.frames()) {
            try {
                const result = await frame.evaluate(() => {
                    const bodyText = document.body.innerText.toLowerCase();
                    if (bodyText.includes("stream error") || bodyText.includes("could not be loaded")) return { status: 'CRITICAL_ERROR' };
                    
                    const v = document.querySelector('video');
                    if (v && !v.ended) {
                        return { status: 'HEALTHY', currentTime: v.currentTime };
                    }
                    return { status: 'DEAD' };
                });

                if (result.status === 'CRITICAL_ERROR') criticalErrorFound = true;
                if (result.status === 'HEALTHY') {
                    overallStatus = 'HEALTHY';
                    currentVideoTime = result.currentTime; 
                }
            } catch (e) {}
        }

        if (overallStatus === 'HEALTHY' && currentVideoTime !== -1) {
            const now = Date.now();
            if (currentVideoTime === lastVideoTime) {
                const timeFrozen = now - frozenCheckTimestamp;
                if (timeFrozen > FROZEN_THRESHOLD_MS) {
                    console.log(`[!] Frozen frame detected! Video time stuck at ${currentVideoTime}s for ${timeFrozen/1000}s.`);
                    overallStatus = 'FROZEN';
                }
            } else {
                lastVideoTime = currentVideoTime;
                frozenCheckTimestamp = now;
            }
        }

        if (criticalErrorFound || overallStatus === 'DEAD' || overallStatus === 'FROZEN') {
            const reason = overallStatus === 'FROZEN' ? "video frozen" : "video dead/error";
            console.log(`\n[!] ❌ STREAM DEAD/FROZEN DETECTED (${reason})! Restarting process...`);
            await takeAndBatchScreenshot(page, 'stream-dead-detected');
            throw new Error(`Watchdog detected ${reason}.`); 
        }

        watchdogTicks++;
        if (watchdogTicks % 120 === 0) {
            console.log(`[🚀] 10-Minute Heartbeat: Taking status screenshot...`);
            await takeAndBatchScreenshot(page, `heartbeat-tick-${watchdogTicks}`);
        }

        await new Promise(r => setTimeout(r, 5000)); 
    }
}

async function cleanup() {
    if (ffmpegProcess) { try { ffmpegProcess.kill('SIGKILL'); } catch(e){} ffmpegProcess = null; }
    if (browser) { try { await browser.close(); } catch(e){} browser = null; }
}

process.on('SIGINT', async () => {
    console.log('\n[*] Stopping live script cleanly...');
    await cleanup();
    process.exit(0);
});

// =========================================================================
// ⏱️ NEW: AUTO-OVERLAP OR EXACT DURATION LOGIC
// =========================================================================
const customDurationStr = process.env.CUSTOM_DURATION || 'None';

function parseDurationToMs(str) {
    if (!str || str.toLowerCase() === 'none') return null;
    let ms = 0;
    const hMatch = str.match(/(\d+)\s*h/i);
    const mMatch = str.match(/(\d+)\s*m/i);
    if (hMatch) ms += parseInt(hMatch[1]) * 60 * 60 * 1000;
    if (mMatch) ms += parseInt(mMatch[1]) * 60 * 1000;
    return ms > 0 ? ms : null;
}

const exactDurationMs = parseDurationToMs(customDurationStr);

if (exactDurationMs) {
    // 🛑 EXACT DURATION MODE (Stop exactly without overlap)
    console.log(`\n[*] 🕒 Custom Duration Detected: ${customDurationStr} (${exactDurationMs / 60000} mins). System will auto-shutdown after this time.`);
    
    setTimeout(async () => {
        console.log(`\n[*] 🛑 Time's up! The assigned duration (${customDurationStr}) is complete. Shutting down cleanly...`);
        await cleanup();
        process.exit(0);
    }, exactDurationMs);

} else {
    // 🔄 DEFAULT OVERLAP MODE (5h 50m loop)
    console.log(`\n[*] 🔄 No Custom Duration specified. Defaulting to 5h 50m Auto-Overlap loop.`);
    
    setTimeout(() => {
        console.log("\n[*] 5h 50m completed! Triggering next action for seamless overlap...");
        try {
            const { execSync } = require('child_process');
            
            const targetUrl = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
            const channel = process.env.OKRU_STREAM_ID || '1';
            const quality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
            const server = process.env.SERVER_SELECTION || 'None';

            const cmd = `gh workflow run main.yml -f target_url="${targetUrl}" -f okru_stream_channel="${channel}" -f stream_quality="${quality}" -f server_selection="${server}" -f custom_duration="None"`;
            
            console.log(`[*] Executing Command: ${cmd}`);
            execSync(cmd, { stdio: 'inherit' });
            
            console.log("[+] Next workflow run successfully triggered!");

            setTimeout(async () => {
                console.log("\n[*] Handing over stream to next action. Shutting down cleanly...");
                await cleanup();
                process.exit(0);
            }, 300000); 

        } catch (err) {
            console.error("[-] Failed to trigger next workflow using GH CLI:", err.message);
        }
    }, 21000000);
}

mainLoop();
