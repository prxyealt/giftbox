const GiftStore = (function () {

    const PHOTO_BUCKET = "gift-photos";
    const MAX_PHOTO_EDGE = 1600;
    const PHOTO_QUALITY = 0.85;

    function config() {
        return window.GIFTBOX_SUPABASE || {};
    }

    function isConfigured() {
        const cfg = config();
        return (cfg.url || "").indexOf("https://") === 0 &&
            !!cfg.publishableKey &&
            cfg.url.indexOf("YOUR_") === -1 &&
            cfg.publishableKey.indexOf("YOUR_") === -1;
    }

    function baseUrl() {
        return config().url.replace(/\/+$/, "");
    }

    function headers(extra) {
        return Object.assign({ apikey: config().publishableKey }, extra || {});
    }

    async function request(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) {
            let detail = "";
            try { detail = await response.text(); } catch (error) { /* ignore */ }
            throw new Error("Request failed (" + response.status + ") " + detail.slice(0, 200));
        }
        return response;
    }

    function dataUrlToBlob(dataUrl) {
        const parts = dataUrl.split(",");
        const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
        const binary = atob(parts[1]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }

    // Downscales large photos and re-encodes them as JPEG. Falls back to the
    // original file if the browser cannot decode it.
    function compressPhoto(dataUrl) {
        return new Promise(function (resolve) {
            const original = dataUrlToBlob(dataUrl);
            const img = new Image();
            img.onload = function () {
                const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(function (blob) { resolve(blob || original); }, "image/jpeg", PHOTO_QUALITY);
            };
            img.onerror = function () { resolve(original); };
            img.src = dataUrl;
        });
    }

    function extensionFor(mime) {
        if (mime === "image/png") return "png";
        if (mime === "image/webp") return "webp";
        return "jpg";
    }

    // Uploads one photo (a data: URL) and returns its public URL. Photos that
    // are already hosted URLs are returned unchanged.
    async function uploadPhoto(giftId, index, src) {

        if (src.indexOf("data:") !== 0) return src;

        const blob = await compressPhoto(src);
        const path = giftId + "/" + index + "." + extensionFor(blob.type);

        await request(baseUrl() + "/storage/v1/object/" + PHOTO_BUCKET + "/" + path, {
            method: "POST",
            headers: headers({ "Content-Type": blob.type, "x-upsert": "false" }),
            body: blob
        });

        return baseUrl() + "/storage/v1/object/public/" + PHOTO_BUCKET + "/" + path;

    }

    async function saveGift(id, data) {
        await request(baseUrl() + "/rest/v1/gifts", {
            method: "POST",
            headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
            body: JSON.stringify({ id: id, data: data })
        });
    }

    // Returns the saved gift data, or null if no gift has that id.
    async function loadGift(id) {
        const response = await request(baseUrl() + "/rest/v1/rpc/get_gift", {
            method: "POST",
            headers: headers({ "Content-Type": "application/json" }),
            body: JSON.stringify({ gift_id: id })
        });
        return response.json();
    }

    return { isConfigured: isConfigured, uploadPhoto: uploadPhoto, saveGift: saveGift, loadGift: loadGift };

})();