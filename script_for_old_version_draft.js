document.getElementById('convertBtn').addEventListener('click', () => {
    const fileInput = document.getElementById('jsonFile');
    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        let name = data.name || "";
        if (!name.trim()) {
            name = "cursed_draft_" + Math.random().toString(36).substring(2, 10);
        }

        let srtContent = "";
        let counter = 1;

        if (data.extra_info && data.extra_info.subtitle_fragment_info_list && data.extra_info.subtitle_fragment_info_list.length > 0) {
            const fragments = data.extra_info.subtitle_fragment_info_list;
            for (const fragment of fragments) {
                const cacheStr = fragment.subtitle_cache_info;
                if (!cacheStr || !cacheStr.trim()) continue;

                const cacheInfo = JSON.parse(cacheStr);
                const text = cacheInfo.sentence_list[0].text;
                const start = formatTime(fragment.start_time);
                const end = formatTime(fragment.end_time);

                srtContent += `${counter++}\n${start} --> ${end}\n${text}\n\n`;
            }
        } else {
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

                textSegments.sort((a, b) => a.target_timerange.start - b.target_timerange.start);

                for (const seg of textSegments) {
                    const text = textsMap[seg.material_id];
                    if (!text) continue;

                    const start = formatTime(seg.target_timerange.start);
                    const end = formatTime(seg.target_timerange.start + seg.target_timerange.duration);

                    srtContent += `${counter++}\n${start} --> ${end}\n${text}\n\n`;
                }
            }
        }

        if (!srtContent) {
            alert("No captions found bro.");
            return;
        }

        const blob = new Blob([srtContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.srt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    reader.readAsText(file);
});

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