(() => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('jsonFile');
    const trayLabel = document.getElementById('trayLabel');
    const reelLeft = document.getElementById('reelLeft');
    const reelRight = document.getElementById('reelRight');
    const statusMsg = document.getElementById('statusMsg');
    const readout = document.getElementById('readout');
    const projName = document.getElementById('projName');
    const projDuration = document.getElementById('projDuration');
    const projCount = document.getElementById('projCount');
    const timeline = document.getElementById('timeline');
    const timelineTrack = document.getElementById('timelineTrack');
    const preview = document.getElementById('preview');
    const previewList = document.getElementById('previewList');
    const downloadBtn = document.getElementById('downloadBtn');

    let srtContent = '';
    let downloadName = 'subtitles';

    // ---- interaction: click / keyboard / drag ----
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleFile(fileInput.files[0]);
    });
    downloadBtn.addEventListener('click', triggerDownload);

    function setSpinning(on) {
        reelLeft.classList.toggle('spin', on);
        reelRight.classList.toggle('spin', on);
    }

    function showError(msg) {
        statusMsg.textContent = msg;
        statusMsg.classList.remove('hidden');
        readout.classList.add('hidden');
        timeline.classList.add('hidden');
        preview.classList.add('hidden');
        downloadBtn.classList.add('hidden');
    }

    function clearError() {
        statusMsg.classList.add('hidden');
        statusMsg.textContent = '';
    }

    function handleFile(file) {
        clearError();
        trayLabel.textContent = file.name;
        setSpinning(true);

        const reader = new FileReader();

        reader.onload = (e) => {
            setTimeout(() => {
                setSpinning(false);
                try {
                    processDraft(e.target.result);
                } catch (err) {
                    showError('Couldn\u2019t read that file: ' + err.message);
                }
            }, 320); // brief spin so the reel motion registers on fast parses
        };

        reader.onerror = () => {
            setSpinning(false);
            showError('That file couldn\u2019t be read. Try selecting it again.');
        };

        reader.readAsText(file);
    }

    function processDraft(rawText) {
        let data;
        try {
            data = JSON.parse(rawText);
        } catch {
            showError('That file doesn\u2019t parse as JSON. Export a draft_content.json from CapCut and try again.');
            return;
        }

        let name = (data.name || '').trim();
        downloadName = name || ('cursed_draft_' + Math.random().toString(36).substring(2, 10));

        const fragments = data.extra_info?.subtitle_fragment_info_list || [];
        const rows = [];

        for (const fragment of fragments) {
            const cacheStr = fragment.subtitle_cache_info;
            if (!cacheStr || !cacheStr.trim()) continue;

            let cacheInfo;
            try {
                cacheInfo = JSON.parse(cacheStr);
            } catch {
                continue;
            }

            const sentences = cacheInfo.sentence_list || [];
            if (!sentences.length) continue;
            const text = sentences.map(s => s.text).filter(Boolean).join('\n');
            if (!text) continue;

            rows.push({
                startMicros: fragment.start_time,
                endMicros: fragment.end_time,
                text
            });
        }

        if (rows.length === 0) {
            const textsMap = {};
            if (data.materials && data.materials.texts) {
                data.materials.texts.forEach(t => {
                    let rawText = t.content || "";
                    try {
                        const parsed = JSON.parse(rawText);
                        rawText = parsed.text || rawText;
                    } catch (err) { }

                    rawText = rawText.replace(/<[^>]+>/g, '').trim();
                    rawText = rawText.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                    textsMap[t.id] = rawText;
                });
            }

            if (data.tracks) {
                let textSegments = [];
                data.tracks.forEach(track => {
                    if (track.type === "text") {
                        textSegments.push(...track.segments);
                    }
                });

                for (const seg of textSegments) {
                    const text = textsMap[seg.material_id];
                    if (!text) continue;

                    rows.push({
                        startMicros: seg.target_timerange.start,
                        endMicros: seg.target_timerange.start + seg.target_timerange.duration,
                        text
                    });
                }
            }
        }

        if (!rows.length) {
            showError('No subtitle track found in this draft.');
            return;
        }

        rows.sort((a, b) => a.startMicros - b.startMicros);

        buildSrt(rows);
        renderReadout(name || downloadName, rows);
        renderTimeline(rows);
        renderPreview(rows);
        downloadBtn.classList.remove('hidden');
    }

    function buildSrt(rows) {
        let out = '';
        let counter = 1;
        for (const row of rows) {
            out += `${counter++}\n${formatTime(row.startMicros)} --> ${formatTime(row.endMicros)}\n${row.text}\n\n`;
        }
        srtContent = out;
    }

    function renderReadout(name, rows) {
        projName.textContent = name;
        projName.title = name;
        const totalMicros = Math.max(...rows.map(r => r.endMicros));
        projDuration.textContent = formatTime(totalMicros);
        projCount.textContent = String(rows.length).padStart(3, '0');
        readout.classList.remove('hidden');
    }

    function renderTimeline(rows) {
        timelineTrack.innerHTML = '';
        const totalMicros = Math.max(...rows.map(r => r.endMicros)) || 1;

        for (const row of rows) {
            const block = document.createElement('div');
            block.className = 'timeline-block';
            const leftPct = (row.startMicros / totalMicros) * 100;
            const widthPct = Math.max(((row.endMicros - row.startMicros) / totalMicros) * 100, 0.25);
            block.style.left = leftPct + '%';
            block.style.width = widthPct + '%';
            block.title = `${formatTime(row.startMicros)} — ${row.text.slice(0, 80)}`;
            timelineTrack.appendChild(block);
        }
        timeline.classList.remove('hidden');
    }

    function renderPreview(rows) {
        previewList.innerHTML = '';
        rows.forEach((row, i) => {
            const li = document.createElement('li');

            const idx = document.createElement('span');
            idx.className = 'row-index';
            idx.textContent = String(i + 1).padStart(2, '0');

            const time = document.createElement('span');
            time.className = 'row-time';
            time.textContent = formatTime(row.startMicros).split(',')[0];

            const text = document.createElement('span');
            text.className = 'row-text';
            text.textContent = row.text;

            li.append(idx, time, text);
            previewList.appendChild(li);
        });
        preview.classList.remove('hidden');
    }

    function triggerDownload() {
        if (!srtContent) return;
        const blob = new Blob([srtContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${downloadName}.srt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function formatTime(micros) {
        let millis = Math.floor(micros / 1000);
        const hours = Math.floor(millis / 3600000);
        millis %= 3600000;
        const mins = Math.floor(millis / 60000);
        millis %= 60000;
        const secs = Math.floor(millis / 1000);
        millis %= 1000;

        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
    }
})();