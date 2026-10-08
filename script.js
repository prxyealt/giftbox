const createGiftButton = document.getElementById("createGiftButton");
const giftCreator = document.getElementById("giftCreator");
const hero = document.querySelector(".hero");


// --------------------------------
// OPEN GIFT CREATOR
// --------------------------------

function setActiveScreen(name) {
    document.body.dataset.screen = name;
}

createGiftButton.addEventListener("click", function () {

    hero.style.display = "none";
    giftCreator.style.display = "flex";
    setActiveScreen("create");

});


// --------------------------------
// SITE MENU DRAWER
// --------------------------------
// One menu shared by every screen. Home and Create a Gift navigate;
// About, Privacy and Cookie entries are inert until those pages exist.

const siteMenuButton = document.getElementById("siteMenuButton");
const siteDrawerClose = document.getElementById("siteDrawerClose");
const siteDrawerScrim = document.getElementById("siteDrawerScrim");
const siteDrawer = document.getElementById("siteDrawer");

function setSiteMenuOpen(isOpen) {

    document.body.classList.toggle("menu-open", isOpen);
    siteMenuButton.setAttribute("aria-expanded", String(isOpen));
    siteDrawer.setAttribute("aria-hidden", String(!isOpen));

    (isOpen ? siteDrawerClose : siteMenuButton).focus();

}

// Shows one top-level screen and hides the others. Gift state is kept,
// so returning to the creator picks up where the user left off.
function showTopLevelScreen(name) {

    hero.style.display = name === "home" ? "" : "none";
    giftCreator.style.display = name === "create" ? "flex" : "none";

    const arrangeEl = document.getElementById("arrangeScreen");
    const previewEl = document.getElementById("finalPreviewScreen");
    if (arrangeEl) arrangeEl.style.display = "none";
    if (previewEl) previewEl.style.display = "none";

    setActiveScreen(name);

}

siteMenuButton.addEventListener("click", function () { setSiteMenuOpen(true); });
siteDrawerClose.addEventListener("click", function () { setSiteMenuOpen(false); });
siteDrawerScrim.addEventListener("click", function () { setSiteMenuOpen(false); });

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && document.body.classList.contains("menu-open")) setSiteMenuOpen(false);
});

document.querySelectorAll(".site-drawer-item[data-menu]").forEach(function (item) {
    item.addEventListener("click", function () {
        document.body.classList.remove("menu-open");
        siteMenuButton.setAttribute("aria-expanded", "false");
        siteDrawer.setAttribute("aria-hidden", "true");
        showTopLevelScreen(item.dataset.menu === "create" ? "create" : "home");
        siteMenuButton.focus();
    });
});


// --------------------------------
// GIFT SELECTIONS
// --------------------------------

const giftSelections = {

    box: null,
    boxColor: "#F4C2C2",
    ribbonColor: "#C94C4C",
    ribbonStyle: "classic",
    bagColor: "#B3D9FF",
    bagAccent: "#FFFFFF",
    bagHandle: "#8AA9C0",
    heartColor: "#F4C2C2",
    heartAccent: "#C94C4C",
    flowers: null,
    flowerColor: "#C94C4C",
    flowerPaperColor: "#F4E9DC",
    flowerRibbonColor: "#C94C4C",
    photos: null,
    letter: null,
    letterMessage: "",
    letterPaperColor: "#FFFDF6",
    letterEnvelope: "none",
    letterStartsOpen: true,
    letterEnvelopeColor: "#F2E4D8",
    letterSeal: "none",
    letterSealColor: "#C94C4C",
    letterSealDesign: "circle",
    plushie: "none"

};


// --------------------------------
// CONTENT ITEM ARCHITECTURE
// --------------------------------
// This is the shared system every gift "content" type (Letter, Photos,
// Drawing, Song) will plug into. It doesn't render anything of its own
// yet - Letter/Photos/Drawing get built on top of this in later
// steps. Setting it up now means each new content type follows the
// same rules instead of getting its own one-off logic.
//
// One content item = { id, type, data, state, position }
// - type:     "letter" | "photoStrip" | "drawing" | "song"
// - data:     whatever that content type needs (text, image urls, etc.)
// - state:    "normal" (small, sitting in the gift scene) or
//             "enlarged" (opened up for a closer view)
// - position: a named anchor slot from giftScenePositions below,
//             chosen for the box type that's currently selected

let contentItems = [];
let nextContentItemId = 1;

function createContentItem(type, data) {

    const item = {
        id: "content-" + nextContentItemId++,
        type: type,
        data: data,
        state: "normal",
        position: null
    };

    contentItems.push(item);
    renderContentItems();

    return item;

}

function removeContentItemsByType(type) {

    contentItems = contentItems.filter(function (item) {
        return item.type !== type;
    });

    renderContentItems();

}

function getContentItem(id) {

    return contentItems.find(function (item) {
        return item.id === id;
    });

}

function openContentItem(id) {

    const item = getContentItem(id);
    if (!item) return;

    item.state = "enlarged";
    renderContentItems();

}

function closeContentItem(id) {

    const item = getContentItem(id);
    if (!item) return;

    item.state = "normal";
    renderContentItems();

}


// --------------------------------
// GIFT SCENE POSITIONS
// --------------------------------
// Each box type gets its own named anchor slots so content can
// eventually be arranged differently per container (a bag holds
// things inside it, a present has things emerging from the open lid,
// and so on). Nothing reads these yet - Letter/Photos/Drawing
// will claim slots from here once they're built in later steps.

const giftScenePositions = {

    present: {
        letter: { top: "62%", left: "50%" },
        photoStrip: { top: "72%", left: "30%" },
        drawing: { top: "72%", left: "70%" },
        song: { top: "50%", left: "50%" }
    },

    bag: {
        letter: { top: "56%", left: "45%" },
        photoStrip: { top: "56%", left: "65%" },
        drawing: { top: "46%", left: "50%" },
        song: { top: "50%", left: "50%" }
    },

    heart: {
        letter: { top: "60%", left: "50%" },
        photoStrip: { top: "70%", left: "35%" },
        drawing: { top: "70%", left: "65%" },
        song: { top: "50%", left: "50%" }
    }

};


// --------------------------------
// GIFT CONTENTS LAYER (render target)
// --------------------------------

const giftContentsLayer = document.getElementById("giftContentsLayer");

// These are declared here (rather than down in their respective
// sections) because renderContentItems() reads them directly, and this
// function can run during the very first synchronous pass through this
// file (applyLetterPaperColor() calls it from the "Apply the starting
// colors" initialization block further down) - before the PHOTOS/LETTER
// sections further down the file would otherwise declare them. See the
// bug-fix notes from the previous pass for why that ordering matters.
let photoStrips = [];
let expandedStripId = null;

// --------------------------------
// PREVIEW CATEGORY ISOLATION
// --------------------------------
// Only ONE main category (Box, Flowers, or Letter) is shown in the live
// preview at a time, matching whichever section the creator is
// currently working in - selecting a bouquet doesn't leave it sitting
// behind the box preview, adding a photo strip doesn't pull the
// bouquet along with it, and so on. This never clears any of the
// creator's actual selections (giftSelections.box, giftSelections.
// flowers, giftSelections.letter*, photoStrips, etc. are untouched) -
// it only controls what's currently visible. Photos content (rendered
// separately into giftContentsLayer) is gated by this same value
// inside renderContentItems() below; Letter has its own dedicated
// preview handled here since - like Box and Flowers - it's a full
// standalone visual rather than a small scene item.

let currentPreviewCategory = null;

function updatePreviewVisibility() {

    allPreviews.forEach(function (preview) {
        preview.style.display = "none";
    });

    if (currentPreviewCategory === "box") {

        if (giftSelections.box === "present") presentPreview.style.display = "block";
        else if (giftSelections.box === "bag") bagPreview.style.display = "block";
        else if (giftSelections.box === "heart") heartPreview.style.display = "block";

    } else if (currentPreviewCategory === "flowers") {

        if (giftSelections.flowers === "rose") roseBouquetPreview.style.display = "block";
        else if (giftSelections.flowers === "realisticRose") realisticRoseBouquetPreview.style.display = "block";
        else if (giftSelections.flowers === "tulips") tulipsBouquetPreview.style.display = "block";
        else if (giftSelections.flowers === "lilies") liliesBouquetPreview.style.display = "block";
        else if (giftSelections.flowers === "daisies") daisiesBouquetPreview.style.display = "block";
        else if (giftSelections.flowers === "sunflowers") sunflowersBouquetPreview.style.display = "block";

    } else if (currentPreviewCategory === "letter") {

        if (giftSelections.letter === "add") {
            letterPreview.style.display = "block";
            renderLetterPreview();
        }

    } else if (currentPreviewCategory === "plushies") {

        if (giftSelections.plushie === "teddy") teddyPlushiePreview.style.display = "block";
        else if (giftSelections.plushie === "bunny") bunnyPlushiePreview.style.display = "block";
        else if (giftSelections.plushie === "cat") catPlushiePreview.style.display = "block";
        else if (giftSelections.plushie === "puppy") puppyPlushiePreview.style.display = "block";

    }

    // "box" with no box chosen yet, "flowers" with none chosen yet,
    // "letter" with no letter added yet, "plushies" set to "none" (or
    // nothing chosen yet), or any other category (photos/null) all
    // fall through to "everything hidden," which is exactly the empty
    // state we want.

}

// --------------------------------
// LETTER PREVIEW (render target)
// --------------------------------
// Keeps the dedicated Letter preview in sync with giftSelections.
// Safe to call any time (message typed, paper color changed, envelope
// or seal toggled) - it just re-applies current state to the existing
// elements rather than rebuilding anything, since the letter preview's
// structure never changes shape the way the photo strips do.

// Transient UI-only state (not part of giftSelections, since it's just
// "what's currently shown," not a choice the creator made that needs
// to be remembered/combined later):
//   - letterIsOpen: has the envelope been clicked open in this preview?
//   - letterFullPreviewOpen: is the full-text reading overlay showing?
let letterIsOpen = false;
let letterFullPreviewOpen = false;

function renderLetterPreview() {

    if (!letterPaperText) return;

    letterPaperText.textContent = giftSelections.letterMessage || "";

    const hasEnvelope = giftSelections.letterEnvelope === "yes";
    const hasSeal = hasEnvelope && giftSelections.letterSeal === "yes";
    const sealDesign = giftSelections.letterSealDesign || "circle";

    letterPreview.classList.toggle("has-envelope", hasEnvelope);
    letterPreview.classList.toggle("letter-open", hasEnvelope && letterIsOpen);

    envelopeGraphic.style.display = hasEnvelope ? "block" : "none";
    envelopeSealGraphic.style.display = hasSeal ? "block" : "none";

    envelopeSealGraphic.className = "envelope-seal";
    if (sealDesign !== "circle") {
        envelopeSealGraphic.classList.add("seal-design-" + sealDesign);
    }

    if (letterPreviewHint) {
        if (!hasEnvelope) {
            letterPreviewHint.textContent = "Click to read full letter";
        } else if (!letterIsOpen) {
            letterPreviewHint.textContent = "Click to open";
        } else {
            letterPreviewHint.textContent = "Click to read full letter";
        }
    }

    if (letterPutAwayButton) {
        letterPutAwayButton.style.display = (hasEnvelope && letterIsOpen) ? "block" : "none";
    }

}

// Builds the enlarged strip overlay; clicking the backdrop calls onClose.
function buildStripOverlay(strip, onClose) {

    const layoutInfo = STRIP_LAYOUTS[strip.layout];
    const styleKey = strip.style || "classic";
    const styleCfg = STRIP_STYLE_CONFIG[styleKey] || STRIP_STYLE_CONFIG.classic;
    const classicDesign = strip.classicDesign || "simple";
    const polaroidDesign = strip.polaroidDesign || "classic";
    const orientation = strip.frameOrientation || "square";
    const orientationRatio = FRAME_ORIENTATION_RATIOS[orientation] || FRAME_ORIENTATION_RATIOS.square;
    const overlayCellWidth = Math.round(styleCfg.overlayCell * orientationRatio.w);
    const overlayCellHeight = (styleKey === "polaroid" && orientation === "square")
        ? Math.round(overlayCellWidth * POLAROID_CELL_ASPECT)
        : Math.round(styleCfg.overlayCell * orientationRatio.h);

    const overlay = document.createElement("div");
    overlay.classList.add("photo-strip-overlay");

    const card = document.createElement("div");
    card.classList.add("photo-strip-overlay-card", "strip-style-" + styleKey);
    if (styleKey === "classic") {
        card.classList.add("classic-" + classicDesign);
        card.style.backgroundColor = strip.color;
    } else if (styleKey === "polaroid") {
        card.classList.add("polaroid-" + polaroidDesign);
        card.style.setProperty("--mat-color", getPolaroidMatColor(strip));
    }

    const grid = document.createElement("div");
    grid.classList.add("photo-strip-overlay-grid", "strip-style-" + styleKey);
    grid.style.gridTemplateColumns = "repeat(" + layoutInfo.cols + ", " + overlayCellWidth + "px)";
    grid.style.gridAutoRows = overlayCellHeight + "px";

    const decorScale = styleCfg.overlayCell / styleCfg.cellSize;

    strip.photos.forEach(function (photoSrc) {
        const frame = document.createElement("div");
        frame.classList.add("photo-strip-photo-frame");

        if (styleKey === "polaroid") {
            frame.style.backgroundColor = strip.color;
            const chinDecor = buildPolaroidChinDecor(polaroidDesign);
            if (chinDecor) frame.appendChild(chinDecor);
        }

        const img = document.createElement("img");
        img.classList.add("photo-strip-overlay-photo");
        img.src = photoSrc;
        img.alt = "Gift photo";

        frame.appendChild(img);
        grid.appendChild(frame);
    });

    card.appendChild(grid);
    overlay.appendChild(card);

    const overlayDecorLayer = (styleKey === "classic")
        ? buildClassicDecorLayer(classicDesign, strip.photos.length, layoutInfo.cols)
        : (styleKey === "polaroid")
            ? buildPolaroidDecorLayer(polaroidDesign, strip.photos.length, layoutInfo.cols)
            : null;
    if (overlayDecorLayer) card.appendChild(overlayDecorLayer);

    // No close button: clicking the dimmed backdrop (outside the
    // strip) closes the preview; clicks on the strip itself,
    // including its photos, never do.
    card.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    overlay.addEventListener("click", onClose);

    return overlay;

}

// Full-letter reading overlay - always shows the COMPLETE message
// (giftSelections.letterMessage is never truncated or modified; only
// the compact preview's display is visually clipped via CSS
// line-clamp). Appended to the document body since it's a fixed,
// full-viewport overlay like the photo strip overlay.
function renderLetterFullOverlay() {

    const existing = document.getElementById("letterFullOverlay");
    if (existing) existing.remove();

    if (!letterFullPreviewOpen) return;

    const overlay = document.createElement("div");
    overlay.id = "letterFullOverlay";
    overlay.classList.add("photo-strip-overlay");

    const card = document.createElement("div");
    card.classList.add("photo-strip-overlay-card", "letter-full-overlay-card");
    card.style.backgroundColor = giftSelections.letterPaperColor;

    const message = document.createElement("p");
    message.classList.add("letter-full-overlay-message");
    message.textContent = giftSelections.letterMessage || "(No message written yet.)";

    const closeButton = document.createElement("button");
    closeButton.classList.add("photo-strip-close");
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", function (event) {
        event.stopPropagation();
        letterFullPreviewOpen = false;
        renderLetterFullOverlay();
    });

    card.appendChild(message);
    card.appendChild(closeButton);
    overlay.appendChild(card);

    overlay.addEventListener("click", function () {
        letterFullPreviewOpen = false;
        renderLetterFullOverlay();
    });

    card.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    document.body.appendChild(overlay);

}

// Builds one photo strip's visual DOM (frame, photos, style/design
// classes, decorations) without any click/interaction wiring - shared
// by the isolated Photos preview (renderContentItems, which attaches
// its own click-to-expand handler) and the Arrange screen (which
// leaves it static, since items are dragged there instead).
function buildPhotoStripVisual(strip) {

    const layoutInfo = STRIP_LAYOUTS[strip.layout];
    const styleKey = strip.style || "classic";
    const styleCfg = STRIP_STYLE_CONFIG[styleKey] || STRIP_STYLE_CONFIG.classic;
    const classicDesign = strip.classicDesign || "simple";
    const polaroidDesign = strip.polaroidDesign || "classic";
    const orientation = strip.frameOrientation || "square";
    const orientationRatio = FRAME_ORIENTATION_RATIOS[orientation] || FRAME_ORIENTATION_RATIOS.square;
    const cellWidth = Math.round(styleCfg.cellSize * orientationRatio.w);
    // A Polaroid frame is a square photo plus its thick chin, so a
    // "square" Polaroid cell is taller than it is wide (the other
    // framings already carry their own proportions).
    const cellHeight = (styleKey === "polaroid" && orientation === "square")
        ? Math.round(cellWidth * POLAROID_CELL_ASPECT)
        : Math.round(styleCfg.cellSize * orientationRatio.h);

    const stripEl = document.createElement("div");
    stripEl.classList.add("photo-strip-scene", "strip-style-" + styleKey);
    if (styleKey === "classic") {
        stripEl.classList.add("classic-" + classicDesign);
    } else if (styleKey === "polaroid") {
        stripEl.classList.add("polaroid-" + polaroidDesign);
    }
    stripEl.style.gridTemplateColumns = "repeat(" + layoutInfo.cols + ", " + cellWidth + "px)";
    stripEl.style.gridAutoRows = cellHeight + "px";

    // Classic uses the creator's chosen strip color as its backing.
    // Film has its own fixed dark-stock look where a background tint
    // wouldn't read as intended, so it ignores color by design.
    // Polaroid also responds to color - each photo's white mount is
    // tinted, while the photo itself is left untouched.
    if (styleKey === "classic") {
        stripEl.style.backgroundColor = strip.color;
    } else if (styleKey === "polaroid") {
        stripEl.style.setProperty("--mat-color", getPolaroidMatColor(strip));
    }

    strip.photos.forEach(function (photoSrc) {
        const frame = document.createElement("div");
        frame.classList.add("photo-strip-photo-frame");

        if (styleKey === "polaroid") {
            frame.style.backgroundColor = strip.color;
            const chinDecor = buildPolaroidChinDecor(polaroidDesign);
            if (chinDecor) frame.appendChild(chinDecor);
        }

        const img = document.createElement("img");
        img.classList.add("photo-strip-scene-photo");
        img.src = photoSrc;
        img.alt = "Gift photo";

        frame.appendChild(img);
        stripEl.appendChild(frame);
    });

    const decorLayer = (styleKey === "classic")
        ? buildClassicDecorLayer(classicDesign, strip.photos.length, layoutInfo.cols)
        : (styleKey === "polaroid")
            ? buildPolaroidDecorLayer(polaroidDesign, strip.photos.length, layoutInfo.cols)
            : null;
    if (decorLayer) stripEl.appendChild(decorLayer);

    return stripEl;

}

function renderContentItems() {

    if (!giftContentsLayer) return;

    giftContentsLayer.innerHTML = "";

    // Only render photo strips while the Photos section is the active
    // preview category, and only strips that actually have at least
    // one photo - an empty strip configuration doesn't show anything.
    const visibleStrips = (currentPreviewCategory === "photos")
        ? (typeof photoStrips !== "undefined" ? photoStrips : [])
            .filter(function (strip) { return strip.photos.length > 0; })
        : [];

    if (visibleStrips.length > 0) {

        // Strips are laid out with plain flexbox centering (see
        // .gift-contents-layer.has-photo-strips in style.css) rather
        // than being individually positioned by percentage - that
        // keeps 1, 2, or 3 strips centered and evenly spaced on any
        // screen size without needing per-count offset math.
        giftContentsLayer.classList.add("has-photo-strips");

        visibleStrips.forEach(function (strip) {

            const stripEl = buildPhotoStripVisual(strip);

            stripEl.addEventListener("click", function () {
                expandedStripId = strip.id;
                renderContentItems();
            });

            giftContentsLayer.appendChild(stripEl);

        });

        if (expandedStripId) {

            const strip = visibleStrips.find(function (s) { return s.id === expandedStripId; });

            if (strip) {

                const overlay = buildStripOverlay(strip, function () {
                    expandedStripId = null;
                    renderContentItems();
                });
                giftContentsLayer.appendChild(overlay);

            }

        }

    } else {

        giftContentsLayer.classList.remove("has-photo-strips");

    }

    // Force a synchronous reflow after rebuilding this layer. Without
    // this, some browsers were observed to leave newly-added photo
    // strip elements unpainted until an unrelated layout change (like
    // opening a different sidebar section) triggered a repaint - this
    // guarantees the preview updates the instant state changes,
    // with no need to navigate away and back.
    void giftContentsLayer.offsetHeight;

}


// --------------------------------
// DROPDOWN SYSTEM
// --------------------------------

const menuButtons = document.querySelectorAll(".menu-button");
const dropdowns = document.querySelectorAll(".dropdown");

// Maps each sidebar menu button to the preview category it controls,
// so opening/switching to that section also isolates the preview to
// just that category (see PREVIEW CATEGORY ISOLATION above).
const menuButtonCategoryMap = {
    boxButton: "box",
    flowersButton: "flowers",
    photosButton: "photos",
    letterButton: "letter",
    plushiesButton: "plushies"
};

menuButtons.forEach(function (button) {

    button.addEventListener("click", function () {

        const dropdown = button.nextElementSibling;
        const isOpen = dropdown.classList.contains("open");

        dropdowns.forEach(function (item) {
            item.classList.remove("open");
        });

        if (!isOpen) {
            dropdown.classList.add("open");
        }

        const category = menuButtonCategoryMap[button.id];
        if (category) {
            currentPreviewCategory = category;
            updatePreviewVisibility();
        }

        // Safety net: re-sync the main gift preview with the current
        // state every time the sidebar changes sections, in case
        // anything (Photos, Letter, etc.) mutated state without the
        // preview picking it up immediately.
        if (typeof renderContentItems === "function") {
            renderContentItems();
        }

    });

});


// --------------------------------
// GIFT BOX OPEN STATE
// --------------------------------
// Centralizes "is the current box open" so the content layer (once it
// has real content in it) can react consistently no matter which of
// the four box types is active. Present and Heart Box lift a lid;
// Bag has no lid, so they get a lighter "settle" animation
// instead - see the .open rules in style.css for each box type.

let giftBoxIsOpen = false;

function setBoxOpen(isOpen) {

    giftBoxIsOpen = isOpen;

    allBoxPreviews.forEach(function (preview) {
        preview.classList.toggle("open", isOpen);
    });

    renderContentItems();

}

function toggleBoxOpen() {
    setBoxOpen(!giftBoxIsOpen);
}


// --------------------------------
// BOX ELEMENTS
// --------------------------------

const boxOptions = document.querySelectorAll(
    "#boxDropdown .box-choice"
);

const boxCustomizations = document.querySelectorAll(
    ".box-customization"
);

const presentPreview = document.getElementById("presentPreview");

const presentBox = document.querySelector(".present-box");
const presentLid = document.querySelector(".present-lid");

// The vertical ribbon is split into two pieces in the markup (one over
// the lid, one over the box) so it can open naturally with the lid -
// so color/style changes need to apply to ALL of them, not just the
// first match.
const ribbonVerticalPieces = document.querySelectorAll(
    ".present-ribbon-vertical"
);

const ribbonVerticalSheens = document.querySelectorAll(
    ".ribbon-sheen-v"
);

const ribbonHorizontal = document.querySelector(
    ".present-ribbon-horizontal"
);

const ribbonHorizontalSheen = document.querySelector(
    ".ribbon-sheen-h"
);

const bow = document.querySelector(
    ".present-bow"
);

const bagPreview = document.getElementById("bagPreview");
const heartPreview = document.getElementById("heartPreview");
const giftPreview = document.getElementById("giftPreview");

const flowerCustomization = document.getElementById("flowerCustomization");
const roseBouquetPreview = document.getElementById("roseBouquetPreview");
const realisticRoseBouquetPreview = document.getElementById("realisticRoseBouquetPreview");
const tulipsBouquetPreview = document.getElementById("tulipsBouquetPreview");
const liliesBouquetPreview = document.getElementById("liliesBouquetPreview");
const daisiesBouquetPreview = document.getElementById("daisiesBouquetPreview");
const sunflowersBouquetPreview = document.getElementById("sunflowersBouquetPreview");

const letterPreview = document.getElementById("letterPreview");
const envelopeGraphic = document.getElementById("envelopeGraphic");
const envelopeSealGraphic = document.getElementById("envelopeSealGraphic");
const letterPaperCard = document.getElementById("letterPaperCard");
const letterPaperText = document.getElementById("letterPaperText");
const letterSealSection = document.getElementById("letterSealSection");
const letterPreviewHint = document.getElementById("letterPreviewHint");
const letterPutAwayButton = document.getElementById("letterPutAwayButton");

const teddyPlushiePreview = document.getElementById("teddyPlushiePreview");
const bunnyPlushiePreview = document.getElementById("bunnyPlushiePreview");
const catPlushiePreview = document.getElementById("catPlushiePreview");
const puppyPlushiePreview = document.getElementById("puppyPlushiePreview");

const allPreviews = [
    presentPreview,
    bagPreview,
    heartPreview,
    roseBouquetPreview,
    realisticRoseBouquetPreview,
    tulipsBouquetPreview,
    liliesBouquetPreview,
    daisiesBouquetPreview,
    sunflowersBouquetPreview,
    letterPreview,
    teddyPlushiePreview,
    bunnyPlushiePreview,
    catPlushiePreview,
    puppyPlushiePreview
];

// The three container previews specifically - the ones that support the
// open/close interaction (the bouquet previews don't).
const allBoxPreviews = [
    presentPreview,
    bagPreview,
    heartPreview
];


// --------------------------------
// BOX OPEN / CLOSE ON CLICK
// --------------------------------
// Every container type opens and closes the same way now - click to
// toggle - routed through setBoxOpen() so the content layer always
// stays in sync with whichever box is showing.

allBoxPreviews.forEach(function (preview) {

    preview.addEventListener("click", function () {

        toggleBoxOpen();

    });

});


// --------------------------------
// BOX SELECTION
// --------------------------------

boxOptions.forEach(function (option) {

    option.addEventListener("click", function () {

        boxOptions.forEach(function (item) {
            item.classList.remove("selected");
        });

        option.classList.add("selected");

        giftSelections.box = option.dataset.box;

        boxCustomizations.forEach(function (section) {
            section.classList.remove("active");
        });

        flowerCustomization.classList.remove("active");

        // Box is now the active preview category, and this call shows
        // exactly the box type just chosen (or nothing, for "No
        // Container") without needing to touch any other preview.
        currentPreviewCategory = "box";
        updatePreviewVisibility();

        // Switching box types always starts from a closed box, so the
        // new preview doesn't inherit an "open" look from whatever was
        // selected before.
        setBoxOpen(false);


        if (giftSelections.box === "present") {

            document
                .getElementById("presentCustomization")
                .classList.add("active");

        }


        else if (giftSelections.box === "bag") {

            document
                .getElementById("bagCustomization")
                .classList.add("active");

        }


        else if (giftSelections.box === "heart") {

            document
                .getElementById("heartCustomization")
                .classList.add("active");

        }


        console.log("Box:", giftSelections.box);

    });

});


// --------------------------------
// BOX COLOR
// --------------------------------

const boxColorButton =
    document.getElementById("boxColorButton");

const boxColorPicker =
    document.getElementById("boxColorPicker");

const customColorInput =
    document.getElementById("customColorInput");


// --------------------------------
// RECENTLY USED COLORS (shared by every color picker in the project)
// --------------------------------
// Each color control ("boxColor", "flowerColor", etc.)
// gets its own small recently-used history, stored under its own
// localStorage key and shown in its own picker panel. Box Color kept
// its original storage key ("giftboxRecentColors") and its hardcoded
// HTML container (#recentColors) so existing saved colors aren't lost;
// every other picker gets its "Recently Used" row created here in JS
// so the HTML for those panels didn't need to be duplicated by hand.

function recentColorsStorageKey(target) {
    return target === "boxColor"
        ? "giftboxRecentColors"
        : "giftboxRecentColors_" + target;
}

function getRecentColors(target) {

    return JSON.parse(
        localStorage.getItem(recentColorsStorageKey(target))
    ) || [];

}

function ensureRecentColorsContainer(pickerEl, target) {

    if (target === "boxColor") {
        return document.getElementById("recentColors");
    }

    const existing = pickerEl.querySelector(
        ".recent-colors[data-recent-target='" + target + "']"
    );

    if (existing) return existing;

    const heading = document.createElement("h4");
    heading.textContent = "Recently Used";

    const container = document.createElement("div");
    container.classList.add("recent-colors");
    container.setAttribute("data-recent-target", target);

    const customButton = pickerEl.querySelector(".custom-color-button");
    pickerEl.insertBefore(heading, customButton);
    pickerEl.insertBefore(container, customButton);

    return container;

}

function displayRecentColorsFor(target) {

    const pickerEl = document.getElementById(
        colorControlsRegistry.find(function (entry) {
            return entry.target === target;
        }).picker
    );

    const container = ensureRecentColorsContainer(pickerEl, target);

    container.innerHTML = "";

    getRecentColors(target).forEach(function (color) {

        const button = document.createElement("button");

        button.classList.add("recent-color");

        button.style.backgroundColor = color;

        button.addEventListener("click", function () {

            applyColorForTarget(target, color);

        });

        container.appendChild(button);

    });

}

function saveRecentColorFor(target, color) {

    let recent = getRecentColors(target);

    recent = recent.filter(function (item) {
        return item !== color;
    });

    recent.unshift(color);

    recent = recent.slice(0, 8);

    localStorage.setItem(
        recentColorsStorageKey(target),
        JSON.stringify(recent)
    );

    displayRecentColorsFor(target);

}


// --------------------------------
// OPEN BOX COLOR PICKER
// --------------------------------

boxColorButton.addEventListener("click", function () {

    boxColorPicker.classList.toggle("open");

    ribbonColorPicker.classList.remove("open");
    ribbonStylePicker.classList.remove("open");

});


// --------------------------------
// SELECT BOX COLOR
// --------------------------------

function selectBoxColor(color) {

    giftSelections.boxColor = color;

    presentBox.style.fill = color;
    presentLid.style.fill = color;

    presentPreview.style.setProperty("--box-color", color);

    saveRecentColorFor("boxColor", color);

}


// --------------------------------
// PRESET BOX COLORS
// --------------------------------

const colorOptions = document.querySelectorAll(
    "#boxColorPicker .color-option"
);

colorOptions.forEach(function (option) {

    option.addEventListener("click", function () {

        selectBoxColor(option.dataset.color);

    });

});


// --------------------------------
// CUSTOM BOX COLOR
// --------------------------------

customColorInput.addEventListener("input", function () {

    selectBoxColor(customColorInput.value);

});


// --------------------------------
// RIBBON COLOR
// --------------------------------

const ribbonColorButton =
    document.getElementById("ribbonColorButton");

const ribbonColorPicker =
    document.getElementById("ribbonColorPicker");

const customRibbonColorInput =
    document.getElementById("customRibbonColorInput");


// --------------------------------
// OPEN RIBBON COLOR PICKER
// --------------------------------

ribbonColorButton.addEventListener("click", function () {

    ribbonColorPicker.classList.toggle("open");

    boxColorPicker.classList.remove("open");
    ribbonStylePicker.classList.remove("open");

});


// --------------------------------
// SELECT RIBBON COLOR
// --------------------------------

function selectRibbonColor(color) {

    giftSelections.ribbonColor = color;

    ribbonVerticalPieces.forEach(function (piece) {
        piece.style.fill = color;
    });

    ribbonHorizontal.style.fill = color;

    presentPreview.style.setProperty("--ribbon-color", color);

    document.querySelectorAll(
        ".bow-loop, .bow-tail, .bow-center"
    ).forEach(function (part) {

        part.style.fill = color;

    });

    saveRecentColorFor("ribbonColor", color);

}


// --------------------------------
// PRESET RIBBON COLORS
// --------------------------------

const ribbonColorOptions = document.querySelectorAll(
    ".ribbon-color-option"
);

ribbonColorOptions.forEach(function (option) {

    option.addEventListener("click", function () {

        selectRibbonColor(option.dataset.color);

    });

});


// --------------------------------
// CUSTOM RIBBON COLOR
// --------------------------------

customRibbonColorInput.addEventListener(
    "input",
    function () {

        selectRibbonColor(
            customRibbonColorInput.value
        );

    }
);


// --------------------------------
// RIBBON STYLE
// --------------------------------

const ribbonStyleButton =
    document.getElementById("ribbonStyleButton");

const ribbonStylePicker =
    document.getElementById("ribbonStylePicker");


// --------------------------------
// OPEN RIBBON STYLE PICKER
// --------------------------------

ribbonStyleButton.addEventListener("click", function () {

    ribbonStylePicker.classList.toggle("open");

    boxColorPicker.classList.remove("open");
    ribbonColorPicker.classList.remove("open");

});


// --------------------------------
// SELECT RIBBON STYLE
// --------------------------------

// Scoped to #ribbonStylePicker specifically - .style-option is now also
// used by the Letter envelope/seal buttons for a consistent look, and
// an unscoped selector here would incorrectly wire this same
// ribbon-style click behavior onto those unrelated buttons too.
const ribbonStyleOptions =
    document.querySelectorAll("#ribbonStylePicker .style-option");

ribbonStyleOptions.forEach(function (option) {

    option.addEventListener("click", function () {

        ribbonStyleOptions.forEach(function (item) {
            item.classList.remove("selected");
        });

        option.classList.add("selected");

        giftSelections.ribbonStyle =
            option.dataset.ribbonStyle;

        updateRibbonStyle();

    });

});


// --------------------------------
// UPDATE RIBBON STYLE
// --------------------------------

function updateRibbonStyle() {

    const style = giftSelections.ribbonStyle;

    // Every ribbon piece (both vertical segments + both sheens, plus
    // the horizontal band + its sheen) needs to be toggled together -
    // previously only the base rects were toggled, leaving the sheen
    // overlays visible as a stray "streak" even when a piece was
    // supposed to be hidden.
    function setVerticalDisplay(value) {
        ribbonVerticalPieces.forEach(function (piece) {
            piece.style.display = value;
        });
        ribbonVerticalSheens.forEach(function (sheen) {
            sheen.style.display = value;
        });
    }

    function setHorizontalDisplay(value) {
        ribbonHorizontal.style.display = value;
        ribbonHorizontalSheen.style.display = value;
    }


    if (style === "classic") {

        setVerticalDisplay("inline");
        setHorizontalDisplay("inline");
        bow.style.display = "inline";

    }


    else if (style === "cross") {

        setVerticalDisplay("inline");
        setHorizontalDisplay("inline");
        bow.style.display = "none";

    }


    else if (style === "simple") {

        setVerticalDisplay("inline");
        setHorizontalDisplay("none");
        bow.style.display = "none";

    }


    else if (style === "none") {

        setVerticalDisplay("none");
        setHorizontalDisplay("none");
        bow.style.display = "none";

    }

}


// --------------------------------
// BAG / HEART BOX COLORS
// --------------------------------

// A small reusable setup for the simplified single-palette pickers used
// by the newer box types, so each one doesn't need its own hand-wired
// copy of the same open/select/close logic.

const simpleColorPickers = [
    {
        button: "bagColorButton",
        picker: "bagColorPicker",
        target: "bagColor",
        apply: applyBagColor
    },
    {
        button: "bagAccentButton",
        picker: "bagAccentPicker",
        target: "bagAccent",
        apply: applyBagAccent
    },
    {
        button: "bagHandleButton",
        picker: "bagHandlePicker",
        target: "bagHandle",
        apply: applyBagHandle
    },
    {
        button: "heartColorButton",
        picker: "heartColorPicker",
        target: "heartColor",
        apply: applyHeartColor
    },
    {
        button: "heartAccentButton",
        picker: "heartAccentPicker",
        target: "heartAccent",
        apply: applyHeartAccent
    },
    {
        button: "flowerColorButton",
        picker: "flowerColorPicker",
        target: "flowerColor",
        apply: applyFlowerColor
    },
    {
        button: "paperColorButton",
        picker: "paperColorPicker",
        target: "flowerPaper",
        apply: applyFlowerPaper
    },
    {
        button: "flowerRibbonButton",
        picker: "flowerRibbonPicker",
        target: "flowerRibbon",
        apply: applyFlowerRibbon
    },
    {
        button: "letterPaperColorButton",
        picker: "letterPaperColorPicker",
        target: "letterPaper",
        apply: applyLetterPaperColor
    },
    {
        button: "envelopeColorButton",
        picker: "envelopeColorPicker",
        target: "envelopeColor",
        apply: applyEnvelopeColor
    },
    {
        button: "sealColorButton",
        picker: "sealColorPicker",
        target: "sealColor",
        apply: applySealColor
    }
];

const allSimplePickerEls = simpleColorPickers.map(function (entry) {
    return document.getElementById(entry.picker);
});

function applyBagColor(color) {
    giftSelections.bagColor = color;
    bagPreview.style.setProperty("--bag-color", color);
}

function applyBagAccent(color) {
    giftSelections.bagAccent = color;
    bagPreview.style.setProperty("--bag-accent", color);
}

function applyBagHandle(color) {
    giftSelections.bagHandle = color;
    bagPreview.style.setProperty("--bag-handle-color", color);
}

function applyHeartColor(color) {
    giftSelections.heartColor = color;
    heartPreview.style.setProperty("--heart-color", color);
}

function applyHeartAccent(color) {
    giftSelections.heartAccent = color;
    heartPreview.style.setProperty("--heart-accent", color);
}

function applyFlowerPaper(color) {
    giftSelections.flowerPaperColor = color;
    document.querySelectorAll(".bouquet-preview").forEach(function (preview) {
        preview.style.setProperty("--paper-color", color);
    });
}

function applyFlowerRibbon(color) {
    giftSelections.flowerRibbonColor = color;
    document.querySelectorAll(".bouquet-preview").forEach(function (preview) {
        preview.style.setProperty("--bouquet-ribbon-color", color);
    });
}


// --------------------------------
// FLOWER COLOR (base color -> a family of shades)
// --------------------------------
// The creator picks one base color; the flower artwork (Rose, Tulip)
// already has its own layered shading/highlights built in, so what it
// needs from us is a small family of related shades - not one flat
// color repeated everywhere. We derive 4 shades from the chosen hue by
// varying lightness/saturation and hand them to the bouquets as CSS
// variables, which the individual flower heads already reference
// (style="color:var(--flower-shade-a)" etc. in the SVG markup).

function hexToHsl(hex) {

    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {

        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;

        h = h * 60;

    }

    return { h: h, s: s * 100, l: l * 100 };

}

function hslToHex(h, s, l) {

    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    const k = function (n) { return (n + h / 30) % 12; };
    const a = s * Math.min(l, 1 - l);
    const f = function (n) {
        return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    };

    const toHex = function (n) {
        const v = Math.round(f(n) * 255);
        return v.toString(16).padStart(2, "0");
    };

    return "#" + toHex(0) + toHex(8) + toHex(4);

}

function generateFlowerShades(baseHex) {

    const hsl = hexToHsl(baseHex);

    return [
        hslToHex(hsl.h, Math.max(15, hsl.s - 10), Math.min(88, hsl.l + 16)),
        hslToHex(hsl.h, hsl.s, Math.min(80, hsl.l + 2)),
        hslToHex(hsl.h, Math.min(100, hsl.s + 5), Math.max(12, hsl.l - 12)),
        hslToHex(hsl.h, Math.min(100, hsl.s + 8), Math.max(6, hsl.l - 22))
    ];

}

function applyFlowerColor(color) {

    giftSelections.flowerColor = color;

    const shades = generateFlowerShades(color);

    giftPreview.style.setProperty("--flower-shade-a", shades[0]);
    giftPreview.style.setProperty("--flower-shade-b", shades[1]);
    giftPreview.style.setProperty("--flower-shade-c", shades[2]);
    giftPreview.style.setProperty("--flower-shade-d", shades[3]);

}

simpleColorPickers.forEach(function (entry) {

    const buttonEl = document.getElementById(entry.button);
    const pickerEl = document.getElementById(entry.picker);

    buttonEl.addEventListener("click", function () {

        const isOpen = pickerEl.classList.contains("open");

        allSimplePickerEls.forEach(function (el) {
            el.classList.remove("open");
        });

        if (!isOpen) {
            pickerEl.classList.add("open");
        }

    });

    pickerEl.querySelectorAll(".mini-color-option").forEach(function (swatch) {

        swatch.addEventListener("click", function () {
            entry.apply(swatch.dataset.color);
            saveRecentColorFor(entry.target, swatch.dataset.color);
        });

    });

    pickerEl.querySelectorAll(".mini-custom-color-input").forEach(function (input) {

        input.addEventListener("input", function () {
            entry.apply(input.value);
            saveRecentColorFor(entry.target, input.value);
        });

    });

});

// --------------------------------
// RECENTLY USED - REGISTRY + INITIAL DISPLAY
// --------------------------------
// Combines the two "special" pickers (Box Color, Ribbon Color, which
// have their own hand-wired swatches/inputs above) with every entry
// from simpleColorPickers, so displayRecentColorsFor() can look up the
// right picker panel for any target. Declared after simpleColorPickers
// exists since it reads from that array.

const colorControlsRegistry = [
    { target: "boxColor", picker: "boxColorPicker" },
    { target: "ribbonColor", picker: "ribbonColorPicker" }
].concat(simpleColorPickers.map(function (entry) {
    return { target: entry.target, picker: entry.picker };
}));

function applyColorForTarget(target, color) {

    if (target === "boxColor") {
        selectBoxColor(color);
        return;
    }

    if (target === "ribbonColor") {
        selectRibbonColor(color);
        return;
    }

    const entry = simpleColorPickers.find(function (item) {
        return item.target === target;
    });

    if (entry) entry.apply(color);

}

colorControlsRegistry.forEach(function (entry) {
    displayRecentColorsFor(entry.target);
});

// Apply the starting colors so the sprites and CSS variables agree from the start
applyBagColor(giftSelections.bagColor);
applyBagAccent(giftSelections.bagAccent);
applyBagHandle(giftSelections.bagHandle);
applyHeartColor(giftSelections.heartColor);
applyHeartAccent(giftSelections.heartAccent);
applyFlowerPaper(giftSelections.flowerPaperColor);
applyFlowerColor(giftSelections.flowerColor);
applyFlowerRibbon(giftSelections.flowerRibbonColor);
applyLetterPaperColor(giftSelections.letterPaperColor);
applySealColor(giftSelections.letterSealColor);
applyEnvelopeColor(giftSelections.letterEnvelopeColor);


// --------------------------------
// FLOWERS
// --------------------------------

const flowerOptions = document.querySelectorAll(
    "#flowersDropdown .option-button"
);

flowerOptions.forEach(function (option) {

    option.addEventListener("click", function () {

        flowerOptions.forEach(function (item) {
            item.classList.remove("selected");
        });

        option.classList.add("selected");

        giftSelections.flowers =
            option.dataset.flower;

        boxCustomizations.forEach(function (section) {
            section.classList.remove("active");
        });

        flowerCustomization.classList.remove("active");

        // Flowers is now the active preview category, and this call
        // shows exactly the bouquet just chosen (or nothing, for "No
        // Flowers") without needing to touch the box preview.
        currentPreviewCategory = "flowers";
        updatePreviewVisibility();

        setBoxOpen(false);


        if (giftSelections.flowers !== "none") {

            flowerCustomization.classList.add("active");

        }


        // "none" falls through: every preview stays hidden and the
        // customization panel stays closed - no bouquet, no wrap, no ribbon.


        console.log(
            "Flowers:",
            giftSelections.flowers
        );

    });

});


// --------------------------------
// PHOTOS
// --------------------------------
// Up to 3 independent photo strips. Each strip has its own layout
// (which determines how many photo slots it has), its own color, its
// own design style (Classic Photobooth / Film Strip / Polaroid), and
// its own photos. Classic additionally has its own set of decorative
// sub-designs (classicDesign), since it's the one style meant to carry
// a small family of cute/decorated looks rather than a single fixed
// material (Film is deliberately one look; Polaroid is deliberately
// one look).
//
// Data shape per strip: { id, layout, color, style, classicDesign, photos: [dataUrl, ...] }
// This mirrors the shape a saved gift configuration will eventually
// need, even though the actual save/share system isn't built yet.
//
// NOTE: photoStrips itself is declared earlier (see the "GIFT CONTENTS
// LAYER" section above) since renderContentItems() can read it during
// initial page load, before this section would otherwise run.

const STRIP_LAYOUTS = {
    "1x1": { cols: 1, count: 1, label: "1 × 1 (1 photo)" },
    "1x2": { cols: 1, count: 2, label: "1 × 2 (2 photos)" },
    "1x3": { cols: 1, count: 3, label: "1 × 3 (3 photos)" },
    "2x2": { cols: 2, count: 4, label: "2 × 2 (4 photos)" },
    "2x3": { cols: 2, count: 6, label: "2 × 3 (6 photos)" }
};

// The three starting photo-strip designs. cellSize/overlayCell drive
// the actual grid column width (and therefore each photo's size) in
// the in-scene strip and its expanded overlay respectively; everything
// else about each look (padding, gap, background, row height,
// perforation, frame treatment) lives in style.css under the matching
// .strip-style-* class.
const STRIP_STYLES = [
    { key: "classic", label: "Classic" },
    { key: "film", label: "Film" },
    { key: "polaroid", label: "Polaroid" }
];

const POLAROID_CELL_ASPECT = 1.16;

const STRIP_STYLE_CONFIG = {
    classic: { cellSize: 62, overlayCell: 130 },
    film: { cellSize: 58, overlayCell: 120 },
    polaroid: { cellSize: 54, overlayCell: 110 }
};

// Per-strip photo framing: Landscape or Portrait. Applies to every
// photo in the strip at once (not per-photo), giving each cell a
// consistent wide or tall rectangle instead of the near-square default.
// Photos are never distorted - object-fit: cover (in CSS) crops to
// fill whichever rectangle is chosen.
//
// NOTE: an "Auto" option (frame shape following each photo's own
// natural aspect ratio) was deliberately left out. It works fine for
// single-column layouts, but for the 2-column layouts (2x2, 2x3) two
// photos with different natural ratios sitting in the same grid row
// would force mismatched row heights, leaving an awkward gap under
// the shorter photo - inconsistent strip geometry the existing layout
// system can't cleanly avoid. Rather than ship an Auto that only half
// works, only Landscape and Portrait are offered.
const FRAME_ORIENTATIONS = [
    { key: "square", label: "Square" },
    { key: "landscape", label: "Landscape" },
    { key: "portrait", label: "Portrait" }
];

const FRAME_ORIENTATION_RATIOS = {
    square: { w: 1, h: 1 },
    landscape: { w: 1.3, h: 0.82 },
    portrait: { w: 0.82, h: 1.3 }
};

// Classic-only sub-designs, each an original, simple CSS-drawn
// decorative treatment (border style + a small set of positioned
// motifs, built below in CLASSIC_DECOR_SPECS/buildClassicDecorLayer) -
// not copied or traced from any other product. Applied as an extra
// "classic-<key>" class alongside "strip-style-classic" in
// style.css. Only relevant/shown in the sidebar while a strip's style
// is Classic.
const CLASSIC_DESIGNS = [
    { key: "simple", label: "Simple" },
    { key: "hearts", label: "Cute Hearts" },
    { key: "floral", label: "Floral" },
    { key: "stars", label: "Stars" },
    { key: "bows", label: "Bows" },
    { key: "sparkles", label: "Sparkles" }
];

// --------------------------------
// STRIP DECORATION SYSTEM (Classic + Polaroid)
// --------------------------------
// Each decorated design is a small family of different motifs (hearts,
// sparkles, dots, leaves, bows...) in a coordinated palette, drawn as
// tiny inline SVGs - not one emoji repeated. Motifs are positioned
// with CSS calc() against the strip's own margin variables
// (--strip-m-side/--strip-m-top/--strip-m-bottom, see style.css), and
// every motif is centred inside a margin band no larger than that
// band, so nothing can ever be clipped by the strip's edge or overlap
// a photo. The same builder serves the compact strip and the larger
// expanded overlay, since sizes/positions are relative to the margins.

const STRIP_MOTIF_SVG = {
    heart: function (c) { return '<path d="M10 17C2.5 12 3.5 5 7.2 5C8.6 5 9.6 5.8 10 6.8C10.4 5.8 11.4 5 12.8 5C16.5 5 17.5 12 10 17Z" fill="' + c[0] + '"/>'; },
    star4: function (c) { return '<path d="M10 1.5L12.3 7.7L18.5 10L12.3 12.3L10 18.5L7.7 12.3L1.5 10L7.7 7.7Z" fill="' + c[0] + '"/>'; },
    star5: function (c) { return '<path d="M10 1.8L12.4 7.4L18.4 7.9L13.8 11.8L15.3 17.7L10 14.5L4.7 17.7L6.2 11.8L1.6 7.9L7.6 7.4Z" fill="' + c[0] + '"/>'; },
    dot: function (c) { return '<circle cx="10" cy="10" r="3.6" fill="' + c[0] + '"/>'; },
    ring: function (c) { return '<circle cx="10" cy="10" r="5.5" fill="none" stroke="' + c[0] + '" stroke-width="2"/>'; },
    plus: function (c) { return '<path d="M8.6 3H11.4V8.6H17V11.4H11.4V17H8.6V11.4H3V8.6H8.6Z" fill="' + c[0] + '"/>'; },
    flower: function (c) {
        let petals = "";
        for (let i = 0; i < 5; i++) {
            const ang = (i * 72 - 90) * Math.PI / 180;
            petals += '<circle cx="' + (10 + 5 * Math.cos(ang)).toFixed(2) + '" cy="' + (10 + 5 * Math.sin(ang)).toFixed(2) + '" r="3.8" fill="' + c[0] + '"/>';
        }
        return petals + '<circle cx="10" cy="10" r="2.9" fill="' + (c[1] || "#F3D36B") + '"/>';
    },
    leaf: function (c) { return '<path d="M3 16C3 8 9 3 17 3C17 11 12 17 3 16Z" fill="' + c[0] + '"/><path d="M4.5 14.5C8 11 11 8 14.5 5.5" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="1.2" fill="none"/>'; },
    bud: function (c) { return '<path d="M4.5 6C4.5 12.5 6.8 16.5 10 16.5C13.2 16.5 15.5 12.5 15.5 6C13.5 8 12.2 5.2 10 3.5C7.8 5.2 6.5 8 4.5 6Z" fill="' + c[0] + '"/>'; },
    bow: function (c) { return '<path d="M10 10L2.5 5.5L2.5 14.5Z M10 10L17.5 5.5L17.5 14.5Z" fill="' + c[0] + '"/><circle cx="10" cy="10" r="2.5" fill="' + (c[1] || c[0]) + '"/>'; },
    moon: function (c) { return '<path d="M13.5 2.5C8 3 4.5 7 4.5 11.5C4.5 15.5 7.5 18 11.5 18C14.5 18 16.5 16.5 17.5 15C11.5 15.5 8 11.5 10 6.5C10.8 4.5 12 3.3 13.5 2.5Z" fill="' + c[0] + '"/>'; },
    squiggle: function (c) { return '<path d="M2 12C5 5.5 7.5 5.5 10 11C12.5 16.5 15 16.5 18 8" stroke="' + c[0] + '" stroke-width="2.2" stroke-linecap="round" fill="none"/>'; },
    cross: function (c) { return '<path d="M5 5L15 15M15 5L5 15" stroke="' + c[0] + '" stroke-width="2.2" stroke-linecap="round" fill="none"/>'; }
};

const stripMotifUrlCache = {};
function stripMotifUrl(name, colors) {
    const key = name + "|" + colors.join(",");
    if (!stripMotifUrlCache[key]) {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">' + STRIP_MOTIF_SVG[name](colors) + '</svg>';
        stripMotifUrlCache[key] = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    }
    return stripMotifUrlCache[key];
}

// Each design: "side" and "top" are cycled along the margin bands,
// "footer" is the (bigger) centred row in the bottom margin. Entries
// are [motif, [colors], sizeMultiplier].
const STRIP_DECOR_DESIGNS = {

    hearts: {
        side: [["heart", ["#E8637A"], 1], ["dot", ["#F7C6D0"], 0.7], ["heart", ["#F2A7B8"], 0.85], ["star4", ["#C9B2E0"], 0.8], ["dot", ["#FFFFFF"], 0.7]],
        top: [["heart", ["#F2A7B8"], 0.85], ["dot", ["#F7C6D0"], 0.7], ["heart", ["#E8637A"], 1], ["dot", ["#FFFFFF"], 0.7]],
        footer: [["star4", ["#C9B2E0"], 1.1], ["heart", ["#E8637A"], 2], ["dot", ["#F7C6D0"], 0.9], ["heart", ["#F2A7B8"], 1.4], ["star4", ["#C9B2E0"], 1.1]]
    },

    floral: {
        side: [["flower", ["#F2A7B8", "#F3D36B"], 1], ["leaf", ["#8DB07C"], 0.95], ["bud", ["#F6C9A6"], 0.85], ["leaf", ["#8DB07C"], 0.95]],
        top: [["flower", ["#F2A7B8", "#F3D36B"], 1], ["leaf", ["#8DB07C"], 0.9], ["flower", ["#FFFFFF", "#F3D36B"], 0.9], ["leaf", ["#8DB07C"], 0.9]],
        footer: [["leaf", ["#8DB07C"], 1.3], ["flower", ["#F2A7B8", "#F3D36B"], 2], ["flower", ["#FFFFFF", "#F3D36B"], 1.4], ["leaf", ["#8DB07C"], 1.3]]
    },

    stars: {
        side: [["star5", ["#E3B93C"], 1], ["dot", ["#F6D58E"], 0.65], ["moon", ["#F1CB6B"], 0.9], ["star4", ["#B79FD1"], 0.8], ["dot", ["#FFFFFF"], 0.7]],
        top: [["star4", ["#B79FD1"], 0.85], ["dot", ["#F6D58E"], 0.7], ["star5", ["#E3B93C"], 1], ["dot", ["#FFFFFF"], 0.7]],
        footer: [["star4", ["#B79FD1"], 1.1], ["moon", ["#F1CB6B"], 1.7], ["star5", ["#E3B93C"], 2], ["star4", ["#B79FD1"], 1.1]]
    },

    bows: {
        side: [["bow", ["#E8A0AE", "#D9667E"], 1], ["dot", ["#FFFFFF"], 0.7], ["heart", ["#F2A7B8"], 0.8], ["dot", ["#FFFFFF"], 0.7]],
        top: [["bow", ["#E8A0AE", "#D9667E"], 0.95], ["dot", ["#FFFFFF"], 0.7], ["heart", ["#F2A7B8"], 0.8], ["dot", ["#FFFFFF"], 0.7]],
        footer: [["heart", ["#F2A7B8"], 1.1], ["bow", ["#E8A0AE", "#D9667E"], 2.2], ["heart", ["#F2A7B8"], 1.1]]
    },

    sparkles: {
        side: [["star4", ["#B79FD1"], 1], ["dot", ["#9DC3E6"], 0.65], ["plus", ["#F2A7B8"], 0.75], ["ring", ["#B79FD1"], 0.7], ["star4", ["#9DC3E6"], 0.8]],
        top: [["plus", ["#F2A7B8"], 0.75], ["star4", ["#B79FD1"], 1], ["dot", ["#9DC3E6"], 0.65], ["ring", ["#B79FD1"], 0.7]],
        footer: [["plus", ["#F2A7B8"], 1.0], ["star4", ["#9DC3E6"], 1.4], ["star4", ["#B79FD1"], 2], ["star4", ["#9DC3E6"], 1.4], ["plus", ["#F2A7B8"], 1.0]]
    },

    // Polaroid mats reuse the families above ("cute" = hearts, "floral" =
    // floral) plus one of their own.
    doodle: {
        side: [["squiggle", ["#E3B93C"], 1], ["dot", ["#F2A7B8"], 0.65], ["cross", ["#9DC3E6"], 0.7], ["star4", ["#B79FD1"], 0.8]],
        top: [["squiggle", ["#E3B93C"], 1], ["dot", ["#F2A7B8"], 0.65], ["cross", ["#9DC3E6"], 0.7], ["star4", ["#B79FD1"], 0.8]],
        footer: [["cross", ["#9DC3E6"], 1.2], ["squiggle", ["#E3B93C"], 1.8], ["star4", ["#B79FD1"], 1.4], ["dot", ["#F2A7B8"], 1]]
    }

};

const POLAROID_MAT_DEFAULTS = {
    classic: "#EFE4D4",
    cute: "#FADCE3",
    floral: "#DDEBD3",
    doodle: "#FCF0C6",
    minimal: "#F1EFEC"
};

const STRIP_MAT_SWATCHES = ["#EFE4D4", "#FADCE3", "#DDEBD3", "#FCF0C6", "#DCEAF7", "#EFE3F3"];

// Polaroid: Color = the frames, Color 2 = the mat behind them. Color 2
// falls back to the selected design's default until the user picks one.
function getPolaroidMatColor(strip) {
    return strip.color2 || POLAROID_MAT_DEFAULTS[strip.polaroidDesign || "classic"];
}

const POLAROID_DECOR_FAMILY = { classic: null, minimal: null, cute: "hearts", floral: "floral", doodle: "doodle" };

function addStripMotif(layer, entry, left, top, rotate) {
    const item = document.createElement("span");
    item.classList.add("classic-decor-item");
    item.style.left = left;
    item.style.top = top;
    item.style.setProperty("--k", String(entry[2]));
    item.style.backgroundImage = stripMotifUrl(entry[0], entry[1]);
    item.style.transform = "translate(-50%, -50%)" + (rotate ? " rotate(" + rotate + "deg)" : "");
    layer.appendChild(item);
}

// styleKey: "classic" | "polaroid"; familyKey: key into
// STRIP_DECOR_DESIGNS (null = no decoration); photoCount/cols size the
// number of motifs along the margins; cellSize is that style's cell.
function buildStripDecorLayer(familyKey, photoCount, cols, cellSize, withFooter) {

    const family = familyKey && STRIP_DECOR_DESIGNS[familyKey];
    if (!family) return null;

    const rows = Math.max(1, Math.ceil(photoCount / cols));
    const innerW = cols * cellSize;
    const innerH = rows * cellSize;

    const layer = document.createElement("div");
    layer.classList.add("classic-decor-layer");

    const sideCount = Math.max(3, Math.round(innerH / (cellSize * 0.42)));
    const topCount = Math.max(3, Math.round(innerW / (cellSize * 0.42)));

    const bodyTop = "var(--strip-m-top)";
    const bodyH = "(100% - var(--strip-m-top) - var(--strip-m-bottom))";

    // left + right columns (staggered so the two sides don't mirror)
    for (let i = 0; i < sideCount; i++) {
        const f = (i + 0.5) / sideCount;
        const yExpr = "calc(" + bodyTop + " + " + bodyH + " * " + f.toFixed(4) + ")";
        addStripMotif(layer, family.side[i % family.side.length], "calc(var(--strip-m-side) / 2)", yExpr, 0);
        addStripMotif(layer, family.side[(i + 2) % family.side.length], "calc(100% - var(--strip-m-side) / 2)", yExpr, 0);
    }

    // top row (between the corners) + the two top corners
    for (let j = 0; j < topCount; j++) {
        const f = (j + 0.5) / topCount;
        const xExpr = "calc(var(--strip-m-side) + (100% - 2 * var(--strip-m-side)) * " + f.toFixed(4) + ")";
        addStripMotif(layer, family.top[j % family.top.length], xExpr, "calc(var(--strip-m-top) / 2)", 0);
    }
    addStripMotif(layer, family.side[0], "calc(var(--strip-m-side) / 2)", "calc(var(--strip-m-top) / 2)", 0);
    addStripMotif(layer, family.side[0], "calc(100% - var(--strip-m-side) / 2)", "calc(var(--strip-m-top) / 2)", 0);

    // bottom: either a bigger centred footer row (Classic) or the same
    // band motifs as the top (Polaroid, whose bottom margin is slim)
    if (withFooter) {
        const n = family.footer.length;
        family.footer.forEach(function (entry, i) {
            const f = (i + 0.5) / n;
            addStripMotif(layer, entry, (22 + 56 * f).toFixed(2) + "%", "calc(100% - var(--strip-m-bottom) / 2)", 0);
        });
    } else {
        for (let j = 0; j < topCount; j++) {
            const f = (j + 0.5) / topCount;
            const xExpr = "calc(var(--strip-m-side) + (100% - 2 * var(--strip-m-side)) * " + f.toFixed(4) + ")";
            addStripMotif(layer, family.top[(j + 1) % family.top.length], xExpr, "calc(100% - var(--strip-m-bottom) / 2)", 0);
        }
        addStripMotif(layer, family.side[0], "calc(var(--strip-m-side) / 2)", "calc(100% - var(--strip-m-bottom) / 2)", 0);
        addStripMotif(layer, family.side[0], "calc(100% - var(--strip-m-side) / 2)", "calc(100% - var(--strip-m-bottom) / 2)", 0);
    }

    return layer;

}

// Convenience wrappers used by the renderers.
function buildClassicDecorLayer(design, photoCount, cols) {
    if (!design || design === "simple") return null;
    return buildStripDecorLayer(design, photoCount, cols, STRIP_STYLE_CONFIG.classic.cellSize, true);
}

function buildPolaroidDecorLayer(design, photoCount, cols) {
    return buildStripDecorLayer(POLAROID_DECOR_FAMILY[design] || null, photoCount, cols, STRIP_STYLE_CONFIG.polaroid.cellSize, false);
}

// Polaroid-only sub-designs. Polaroid's charm is mostly the white
// frames themselves, so these stay restrained - a single small accent
// (or none) rather than the fuller motif sets Classic uses, plus one
// purely structural variant (Minimal: lighter shadow, no accent).
const POLAROID_DESIGNS = [
    { key: "classic", label: "Classic" },
    { key: "cute", label: "Cute" },
    { key: "floral", label: "Floral" },
    { key: "doodle", label: "Doodle" },
    { key: "minimal", label: "Minimal" }
];

// Polaroid's own decoration also lives inside each photo's "chin" (the
// thick blank strip under the image): one small centred motif per
// frame, sized as a percentage of the frame so it always fits inside
// the chin and is never clipped. "Classic" and "Minimal" have none.
const POLAROID_CHIN_MOTIFS = {
    classic: null,
    minimal: null,
    cute: ["heart", ["#E8637A"]],
    floral: ["flower", ["#F2A7B8", "#F3D36B"]],
    doodle: ["squiggle", ["#E3B93C"]]
};

function buildPolaroidChinDecor(design) {

    const motif = POLAROID_CHIN_MOTIFS[design];
    if (!motif) return null;

    const item = document.createElement("span");
    item.classList.add("polaroid-chin-decor", "polaroid-decor-" + design);
    item.style.backgroundImage = stripMotifUrl(motif[0], motif[1]);

    return item;

}

const MAX_PHOTO_STRIPS = 3;
const STRIP_COLOR_SWATCHES = ["#FFFFFF", "#FDE9E9", "#FFF6D9", "#E3F1E3", "#DCEAF7", "#EFE3F3"];

let nextStripId = 1;
let pendingSlotTarget = null; // { stripId, slotIndex } - set right before opening the file picker

const photoStripsContainer = document.getElementById("photoStripsContainer");
const addStripButton = document.getElementById("addStripButton");

// One shared hidden file input reused for every slot's "browse" click,
// rather than creating a new <input> per slot.
const sharedPhotoFileInput = document.createElement("input");
sharedPhotoFileInput.type = "file";
sharedPhotoFileInput.accept = "image/*";
sharedPhotoFileInput.style.display = "none";
document.body.appendChild(sharedPhotoFileInput);

sharedPhotoFileInput.addEventListener("change", function () {

    const file = sharedPhotoFileInput.files && sharedPhotoFileInput.files[0];
    sharedPhotoFileInput.value = "";

    if (file && pendingSlotTarget) {
        loadImageFileIntoSlot(file, pendingSlotTarget.stripId, pendingSlotTarget.slotIndex);
    }

    pendingSlotTarget = null;

});

function loadImageFileIntoSlot(file, stripId, slotIndex) {

    if (!file.type || file.type.indexOf("image/") !== 0) return;

    const reader = new FileReader();

    reader.onload = function () {

        const strip = photoStrips.find(function (s) { return s.id === stripId; });
        if (!strip) return;

        strip.photos[slotIndex] = reader.result;

        renderPhotoStripsPanel();
        renderContentItems();

    };

    reader.readAsDataURL(file);

}

function addPhotoStrip() {

    if (photoStrips.length >= MAX_PHOTO_STRIPS) return;

    photoStrips.push({
        id: "strip-" + nextStripId++,
        layout: "1x2",
        color: "#FFFFFF",
        style: "classic",
        classicDesign: "simple",
        polaroidDesign: "classic",
        color2: null,
        frameOrientation: "square",
        photos: []
    });

    renderPhotoStripsPanel();
    renderContentItems();

}

function removePhotoStrip(id) {

    photoStrips = photoStrips.filter(function (s) { return s.id !== id; });

    renderPhotoStripsPanel();
    renderContentItems();

}

function setStripLayout(id, layout) {

    const strip = photoStrips.find(function (s) { return s.id === id; });
    if (!strip) return;

    strip.layout = layout;

    const count = STRIP_LAYOUTS[layout].count;
    if (strip.photos.length > count) {
        strip.photos = strip.photos.slice(0, count);
    }

    renderPhotoStripsPanel();
    renderContentItems();

}

function setStripColor(id, color) {

    const strip = photoStrips.find(function (s) { return s.id === id; });
    if (!strip) return;

    strip.color = color;

    renderPhotoStripsPanel();
    renderContentItems();

}

function setStripColor2(id, color) {

    const strip = photoStrips.find(function (s) { return s.id === id; });
    if (!strip) return;

    strip.color2 = color;

    renderPhotoStripsPanel();
    renderContentItems();

}

function setStripStyle(id, style) {

    const strip = photoStrips.find(function (s) { return s.id === id; });
    if (!strip) return;

    strip.style = style;

    renderPhotoStripsPanel();
    renderContentItems();

}

function setStripClassicDesign(id, design) {

    const strip = photoStrips.find(function (s) { return s.id === id; });
    if (!strip) return;

    strip.classicDesign = design;

    renderPhotoStripsPanel();
    renderContentItems();

}

function setStripPolaroidDesign(id, design) {

    const strip = photoStrips.find(function (s) { return s.id === id; });
    if (!strip) return;

    strip.polaroidDesign = design;
    strip.color2 = null;

    renderPhotoStripsPanel();
    renderContentItems();

}

function removePhotoFromStrip(stripId, slotIndex) {

    const strip = photoStrips.find(function (s) { return s.id === stripId; });
    if (!strip) return;

    strip.photos.splice(slotIndex, 1);

    renderPhotoStripsPanel();
    renderContentItems();

}

// Framing (Landscape/Portrait) applies to the whole strip at once,
// rather than each photo having its own separate fit/zoom controls -
// simpler for the creator, and every photo in the strip stays visually
// consistent with the others.
function setStripFrameOrientation(id, orientation) {

    const strip = photoStrips.find(function (s) { return s.id === id; });
    if (!strip) return;

    strip.frameOrientation = orientation;

    renderPhotoStripsPanel();
    renderContentItems();

}

function buildEmptySlot(strip, slotIndex) {

    const slot = document.createElement("div");
    slot.classList.add("photo-strip-slot", "photo-strip-slot-empty");
    slot.setAttribute("tabindex", "0");
    slot.innerHTML = "<span class='slot-plus'>+</span>Add photo";

    slot.addEventListener("click", function () {
        pendingSlotTarget = { stripId: strip.id, slotIndex: slotIndex };
        sharedPhotoFileInput.click();
    });

    slot.addEventListener("dragover", function (event) {
        event.preventDefault();
        slot.classList.add("drag-over");
    });

    slot.addEventListener("dragleave", function () {
        slot.classList.remove("drag-over");
    });

    slot.addEventListener("drop", function (event) {
        event.preventDefault();
        slot.classList.remove("drag-over");
        const file = event.dataTransfer.files && event.dataTransfer.files[0];
        if (file) loadImageFileIntoSlot(file, strip.id, slotIndex);
    });

    slot.addEventListener("paste", function (event) {
        const items = event.clipboardData && event.clipboardData.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image/") === 0) {
                const file = items[i].getAsFile();
                if (file) loadImageFileIntoSlot(file, strip.id, slotIndex);
                break;
            }
        }
    });

    return slot;

}

function buildFilledSlot(strip, slotIndex) {

    const photoSrc = strip.photos[slotIndex];

    const slot = document.createElement("div");
    slot.classList.add("photo-strip-slot", "photo-strip-slot-filled");

    const img = document.createElement("img");
    img.src = photoSrc;
    img.alt = "Uploaded photo";

    const removeButton = document.createElement("button");
    removeButton.classList.add("photo-strip-slot-remove");
    removeButton.textContent = "×";
    removeButton.addEventListener("click", function (event) {
        event.stopPropagation();
        removePhotoFromStrip(strip.id, slotIndex);
    });

    slot.appendChild(img);
    slot.appendChild(removeButton);

    return slot;

}

function buildStripColorRow(labelText, currentColor, swatches, onPick) {

    const row = document.createElement("div");
    row.classList.add("photo-strip-field-row", "photo-strip-color-row");

    const label = document.createElement("label");
    label.textContent = labelText;

    const swatchesWrap = document.createElement("div");
    swatchesWrap.classList.add("photo-strip-color-swatches");

    swatches.forEach(function (color) {
        const swatch = document.createElement("button");
        swatch.classList.add("photo-strip-color-swatch");
        if (color.toLowerCase() === String(currentColor).toLowerCase()) swatch.classList.add("selected");
        swatch.style.backgroundColor = color;
        swatch.addEventListener("click", function () { onPick(color); });
        swatchesWrap.appendChild(swatch);
    });

    const customWrap = document.createElement("span");
    customWrap.classList.add("photo-strip-color-custom-wrap");
    customWrap.title = "Custom color";

    const custom = document.createElement("input");
    custom.type = "color";
    custom.classList.add("photo-strip-color-custom");
    custom.value = currentColor;
    custom.addEventListener("input", function () { onPick(custom.value); });
    customWrap.appendChild(custom);
    swatchesWrap.appendChild(customWrap);

    row.appendChild(label);
    row.appendChild(swatchesWrap);
    return row;

}

function renderPhotoStripsPanel() {

    photoStripsContainer.innerHTML = "";

    photoStrips.forEach(function (strip, stripIndex) {

        const layoutInfo = STRIP_LAYOUTS[strip.layout];

        const card = document.createElement("div");
        card.classList.add("photo-strip-card");

        // Header
        const header = document.createElement("div");
        header.classList.add("photo-strip-card-header");

        const title = document.createElement("h4");
        title.textContent = "Strip " + (stripIndex + 1);

        const removeStripButton = document.createElement("button");
        removeStripButton.classList.add("photo-strip-remove-button");
        removeStripButton.textContent = "Remove";
        removeStripButton.addEventListener("click", function () {
            removePhotoStrip(strip.id);
        });

        header.appendChild(title);
        header.appendChild(removeStripButton);

        // Style row (Classic / Film / Polaroid)
        const styleRow = document.createElement("div");
        styleRow.classList.add("photo-strip-field-row");

        const styleLabel = document.createElement("label");
        styleLabel.textContent = "Photo Style";

        const styleSelect = document.createElement("select");
        styleSelect.classList.add("photo-strip-layout-select");

        STRIP_STYLES.forEach(function (styleDef) {
            const option = document.createElement("option");
            option.value = styleDef.key;
            option.textContent = styleDef.label;
            if (styleDef.key === (strip.style || "classic")) option.selected = true;
            styleSelect.appendChild(option);
        });

        styleSelect.addEventListener("change", function () {
            setStripStyle(strip.id, styleSelect.value);
        });

        styleRow.appendChild(styleLabel);
        styleRow.appendChild(styleSelect);

        // Classic design row (Simple / Cute Hearts / Floral / Stars /
        // Bows / Sparkles) - only relevant/shown when this strip's
        // style is Classic.
        const classicDesignRow = document.createElement("div");
        classicDesignRow.classList.add("photo-strip-field-row");
        if ((strip.style || "classic") !== "classic") {
            classicDesignRow.style.display = "none";
        }

        const classicDesignLabel = document.createElement("label");
        classicDesignLabel.textContent = "Classic Design";

        const classicDesignSelect = document.createElement("select");
        classicDesignSelect.classList.add("photo-strip-layout-select");

        CLASSIC_DESIGNS.forEach(function (designDef) {
            const option = document.createElement("option");
            option.value = designDef.key;
            option.textContent = designDef.label;
            if (designDef.key === (strip.classicDesign || "simple")) option.selected = true;
            classicDesignSelect.appendChild(option);
        });

        classicDesignSelect.addEventListener("change", function () {
            setStripClassicDesign(strip.id, classicDesignSelect.value);
        });

        classicDesignRow.appendChild(classicDesignLabel);
        classicDesignRow.appendChild(classicDesignSelect);

        // Polaroid design row (Classic / Cute / Floral / Doodle /
        // Minimal) - only relevant/shown when this strip's style is
        // Polaroid, following the same pattern as Classic's design row.
        const polaroidDesignRow = document.createElement("div");
        polaroidDesignRow.classList.add("photo-strip-field-row");
        if ((strip.style || "classic") !== "polaroid") {
            polaroidDesignRow.style.display = "none";
        }

        const polaroidDesignLabel = document.createElement("label");
        polaroidDesignLabel.textContent = "Polaroid Design";

        const polaroidDesignSelect = document.createElement("select");
        polaroidDesignSelect.classList.add("photo-strip-layout-select");

        POLAROID_DESIGNS.forEach(function (designDef) {
            const option = document.createElement("option");
            option.value = designDef.key;
            option.textContent = designDef.label;
            if (designDef.key === (strip.polaroidDesign || "classic")) option.selected = true;
            polaroidDesignSelect.appendChild(option);
        });

        polaroidDesignSelect.addEventListener("change", function () {
            setStripPolaroidDesign(strip.id, polaroidDesignSelect.value);
        });

        polaroidDesignRow.appendChild(polaroidDesignLabel);
        polaroidDesignRow.appendChild(polaroidDesignSelect);

        // Framing row (Landscape / Portrait) - one setting per strip,
        // applied to every photo in it, rather than each photo having
        // its own separate framing control.
        const framingRow = document.createElement("div");
        framingRow.classList.add("photo-strip-field-row");

        const framingLabel = document.createElement("label");
        framingLabel.textContent = "Framing";

        const framingSelect = document.createElement("select");
        framingSelect.classList.add("photo-strip-layout-select");

        FRAME_ORIENTATIONS.forEach(function (orientationDef) {
            const option = document.createElement("option");
            option.value = orientationDef.key;
            option.textContent = orientationDef.label;
            if (orientationDef.key === (strip.frameOrientation || "square")) option.selected = true;
            framingSelect.appendChild(option);
        });

        framingSelect.addEventListener("change", function () {
            setStripFrameOrientation(strip.id, framingSelect.value);
        });

        framingRow.appendChild(framingLabel);
        framingRow.appendChild(framingSelect);

        // Layout row
        const layoutRow = document.createElement("div");
        layoutRow.classList.add("photo-strip-field-row");

        const layoutLabel = document.createElement("label");
        layoutLabel.textContent = "Layout";

        const layoutSelect = document.createElement("select");
        layoutSelect.classList.add("photo-strip-layout-select");

        Object.keys(STRIP_LAYOUTS).forEach(function (key) {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = STRIP_LAYOUTS[key].label;
            if (key === strip.layout) option.selected = true;
            layoutSelect.appendChild(option);
        });

        layoutSelect.addEventListener("change", function () {
            setStripLayout(strip.id, layoutSelect.value);
        });

        layoutRow.appendChild(layoutLabel);
        layoutRow.appendChild(layoutSelect);

        const colorRow = buildStripColorRow("Color", strip.color, STRIP_COLOR_SWATCHES, function (color) {
            setStripColor(strip.id, color);
        });

        const isPolaroid = (strip.style || "classic") === "polaroid";
        const color2Row = isPolaroid
            ? buildStripColorRow("Color 2", getPolaroidMatColor(strip), STRIP_MAT_SWATCHES, function (color) {
                setStripColor2(strip.id, color);
            })
            : null;

        // Slots grid
        const slotsGrid = document.createElement("div");
        slotsGrid.classList.add("photo-strip-slots");
        slotsGrid.style.gridTemplateColumns = "repeat(" + layoutInfo.cols + ", 1fr)";
        slotsGrid.style.backgroundColor = isPolaroid ? getPolaroidMatColor(strip) : strip.color;
        slotsGrid.style.padding = "6px";
        slotsGrid.style.borderRadius = "6px";

        for (let i = 0; i < layoutInfo.count; i++) {
            if (strip.photos[i]) {
                slotsGrid.appendChild(buildFilledSlot(strip, i));
            } else {
                slotsGrid.appendChild(buildEmptySlot(strip, i));
            }
        }

        card.appendChild(header);
        card.appendChild(styleRow);
        card.appendChild(classicDesignRow);
        card.appendChild(polaroidDesignRow);
        card.appendChild(framingRow);
        card.appendChild(layoutRow);
        card.appendChild(colorRow);
        if (color2Row) card.appendChild(color2Row);
        card.appendChild(slotsGrid);

        photoStripsContainer.appendChild(card);

    });

    addStripButton.disabled = photoStrips.length >= MAX_PHOTO_STRIPS;
    addStripButton.textContent = photoStrips.length >= MAX_PHOTO_STRIPS
        ? "Maximum of 3 strips reached"
        : "+ Add Photo Strip";

}

addStripButton.addEventListener("click", addPhotoStrip);

renderPhotoStripsPanel();

// --------------------------------
// LETTER
// --------------------------------
// A message + paper color, plus an optional envelope and an optional
// decorative seal on that envelope. Rendered into the dedicated
// #letterPreview (see renderLetterPreview() above) rather than into
// the shared gift-contents layer, since - like Box and Flowers -
// Letter gets its own isolated preview while the creator is editing
// it. If the creator picks "No Letter", nothing renders - no empty
// letter is ever shown.

const letterOptions = document.querySelectorAll(
    "#letterDropdown .option-button"
);

const letterCustomization = document.getElementById("letterCustomization");
const letterMessageInput = document.getElementById("letterMessageInput");

letterOptions.forEach(function (option) {

    option.addEventListener("click", function () {

        letterOptions.forEach(function (item) {
            item.classList.remove("selected");
        });

        option.classList.add("selected");

        giftSelections.letter = option.dataset.letter;

        letterCustomization.classList.toggle(
            "active",
            giftSelections.letter === "add"
        );

        // Letter is now the active preview category, and this shows
        // the letter (or nothing, for "No Letter") without touching
        // the Box or Flowers previews.
        currentPreviewCategory = "letter";
        updatePreviewVisibility();

    });

});

letterMessageInput.addEventListener("input", function () {

    giftSelections.letterMessage = letterMessageInput.value;
    renderLetterPreview();

});

function applyLetterPaperColor(color) {

    giftSelections.letterPaperColor = color;
    letterPreview.style.setProperty("--letter-paper-color", color);
    renderLetterPreview();

}


// --------------------------------
// LETTER - ENVELOPE
// --------------------------------
// Two plain choices, always visible (no separate open/close toggle
// needed for just two buttons). Enabling the envelope also reveals the
// Seal section right below it; disabling it hides that section again
// and resets the seal choice so a hidden "Seal" selection can't linger
// invisibly in the background.

const envelopeOptionButtons = document.querySelectorAll(
    "#envelopeOptions .style-option"
);

envelopeOptionButtons.forEach(function (option) {

    option.addEventListener("click", function () {

        envelopeOptionButtons.forEach(function (item) {
            item.classList.remove("selected");
        });

        option.classList.add("selected");

        giftSelections.letterEnvelope = option.dataset.envelope;

        letterSealSection.classList.toggle(
            "active",
            giftSelections.letterEnvelope === "yes"
        );

        // A fresh envelope (or removing one) always starts "closed" -
        // otherwise switching envelope off and back on could leave the
        // letter looking like it's still mid-animation from before.
        letterIsOpen = false;

        renderLetterPreview();

    });

});


// --------------------------------
// LETTER - INITIAL OPEN / CLOSED STATE (Arrange Gift)
// --------------------------------
// Offered in the Arrange side panel while an enveloped letter is on the
// canvas. Applies to the Arrange and Preview copies; the builder preview
// keeps its own click-to-open behavior.

const letterStatePanel = document.getElementById("arrangeLetterStatePanel");
const letterStateButtons = document.querySelectorAll("#letterStateOptions .style-option");

function updateLetterStatePanel() {

    if (!letterStatePanel) return;

    const letterPlaced = arrangedItems.some(function (item) { return item.kind === "letter"; });
    letterStatePanel.style.display =
        (letterPlaced && giftSelections.letterEnvelope === "yes") ? "block" : "none";

    letterStateButtons.forEach(function (button) {
        const isOpen = button.dataset.letterState === "open";
        button.classList.toggle("selected", isOpen === (giftSelections.letterStartsOpen !== false));
    });

}

letterStateButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        giftSelections.letterStartsOpen = button.dataset.letterState === "open";
        updateLetterStatePanel();
        renderArrangeCanvas(document.getElementById("arrangeCanvas"), true);
    });
});

// --------------------------------
// LETTER - ENVELOPE SEAL
// --------------------------------

const sealOptionButtons = document.querySelectorAll(
    "#sealOptions .style-option"
);

sealOptionButtons.forEach(function (option) {

    option.addEventListener("click", function () {

        sealOptionButtons.forEach(function (item) {
            item.classList.remove("selected");
        });

        option.classList.add("selected");

        giftSelections.letterSeal = option.dataset.seal;

        renderLetterPreview();

    });

});

function applySealColor(color) {

    giftSelections.letterSealColor = color;
    envelopeSealGraphic.style.setProperty("--seal-color", color);

}

function applyEnvelopeColor(color) {

    giftSelections.letterEnvelopeColor = color;
    letterPreview.style.setProperty("--envelope-color", color);

}


// --------------------------------
// LETTER - SEAL DESIGN
// --------------------------------
// Presented as a collapsible panel (matching the Envelope Color / Seal
// Color buttons) rather than a plain label+dropdown, so it feels like
// part of the same control system. The dropdown itself and its
// options are unchanged - only the surrounding open/close chrome and
// its button are new.

const sealDesignButton = document.getElementById("sealDesignButton");
const sealDesignPicker = document.getElementById("sealDesignPicker");
const sealDesignSelect = document.getElementById("sealDesignSelect");

if (sealDesignButton && sealDesignPicker) {

    // Join the same mutual-exclusion group as every color picker, so
    // opening this one closes any open color picker and vice versa.
    allSimplePickerEls.push(sealDesignPicker);

    sealDesignButton.addEventListener("click", function () {

        const isOpen = sealDesignPicker.classList.contains("open");

        allSimplePickerEls.forEach(function (el) {
            el.classList.remove("open");
        });

        if (!isOpen) {
            sealDesignPicker.classList.add("open");
        }

    });

}

if (sealDesignSelect) {
    sealDesignSelect.addEventListener("change", function () {
        giftSelections.letterSealDesign = sealDesignSelect.value;
        renderLetterPreview();
    });
}


// --------------------------------
// LETTER - OPEN / READ / PUT AWAY
// --------------------------------
// One click handler covers both steps of the interaction:
//   - If there's an envelope and it hasn't been opened yet, the first
//     click opens it (plays the reveal animation).
//   - Otherwise (envelope already open, or no envelope at all), a
//     click opens the full-text reading overlay - useful for long
//     letters where the compact preview is truncated.
// A separate small button (shown only once an envelope is open) lets
// the creator tuck the letter back in without leaving the section.

letterPreview.addEventListener("click", function () {

    const hasEnvelope = giftSelections.letterEnvelope === "yes";

    if (hasEnvelope && !letterIsOpen) {
        letterIsOpen = true;
        renderLetterPreview();
        return;
    }

    letterFullPreviewOpen = true;
    renderLetterFullOverlay();

});

if (letterPutAwayButton) {
    letterPutAwayButton.addEventListener("click", function (event) {
        event.stopPropagation();
        letterIsOpen = false;
        renderLetterPreview();
    });
}


// --------------------------------
// PLUSHIES
// --------------------------------
// Purely optional, decorative add-on - "None" is the default and the
// gift works exactly the same with or without one. Follows the same
// isolated-preview pattern as Box/Flowers: selecting a plushie shows
// only that plushie in the preview while this section is open.

const plushieOptions = document.querySelectorAll(
    "#plushiesDropdown .option-button"
);

plushieOptions.forEach(function (option) {

    option.addEventListener("click", function () {

        plushieOptions.forEach(function (item) {
            item.classList.remove("selected");
        });

        option.classList.add("selected");

        giftSelections.plushie = option.dataset.plushie;

        // Plushies is now the active preview category, and this call
        // shows exactly the plushie just chosen (or nothing, for
        // "None") without touching any other preview. Re-running this
        // on every selection (rather than just once) also guarantees
        // switching from one plushie straight to another never leaves
        // the previous one visible - allPreviews is fully hidden and
        // rebuilt from the current selection every time.
        currentPreviewCategory = "plushies";
        updatePreviewVisibility();

        console.log("Plushie:", giftSelections.plushie);

    });

});


// ==================================================
// ARRANGE / FINAL PREVIEW / FINISH GIFT
// ==================================================
// The last step of the experience: freely position every item the
// creator selected (box, flowers, photo strips, letter, plushie, plus
// optional decorations) into one composition, then move on to a
// read-only Preview and a Finish/Share step.
//
// Items are represented as plain data (arrangedItems) - position (as
// % of the canvas, so it's naturally responsive), rotation, scale, and
// z-order - and rendered fresh from that data every time.
//
// The gift box/container is NOT a normal movable item: it's the
// stationary foundation of the arrangement. It's auto-placed (fixed,
// centered, pinned at the back) as soon as Arrange Gift opens, and it
// never gets a drag hitbox, selection outline, or toolbar. Every other
// selected item (flowers, plushie, letter, photo strips) starts in a
// "Your Items" tray and only joins the canvas once the creator taps it
// there, after which it can be freely dragged/rotated/resized/layered.
//
// Arrange and Final Preview share the same arrangedItems data and the
// same reference-canvas scaling model (ARRANGE_REFERENCE_CANVAS_SIZE),
// so whatever canvas pixel size either screen actually renders at, the
// composition looks identical - only Final Preview adds the box-opens/
// items-emerge animation and hides every editing control.

let arrangedItems = [];
let nextArrangedItemId = 1;
let selectedArrangeItemId = null;
let arrangeDragState = null;
let arrangeCloneCounter = 1;
let arrangeCanvasDeselectWired = false;
let previewMessage = "";
let finalPreviewOpened = false;

// All arranged-item pixel sizes/positions are authored against this
// fixed reference canvas size, then uniformly scaled by whatever the
// actual rendered canvas's live width is (getCanvasScale). That's what
// keeps the Arrange canvas and the (differently-sized) Final Preview
// canvas always showing the same relative composition.
const ARRANGE_REFERENCE_CANVAS_SIZE = 520;

// Every CSS custom property used anywhere in the app that a cloned
// preview might depend on for its color. Copying the resolved value
// from the ORIGINAL element onto the CLONE (as its own inline style)
// makes the clone self-contained - once it's moved into the Arrange
// canvas's own DOM subtree, it's no longer a descendant of whichever
// element originally set these variables, so without this it would
// silently lose its chosen colors.
const ARRANGE_PRESERVED_CSS_VARS = [
    "--box-color", "--ribbon-color",
    "--bag-color", "--bag-accent", "--bag-handle-color",
    "--heart-color", "--heart-accent",
    "--paper-color", "--bouquet-ribbon-color",
    "--flower-shade-a", "--flower-shade-b", "--flower-shade-c", "--flower-shade-d",
    "--letter-paper-color", "--seal-color", "--envelope-color"
];

const ARRANGE_DECORATION_GLYPHS = ["♥", "❀", "★", "✦", "🎀", "✿"];

function copyCssVars(sourceEl, targetEl, varNames) {

    const computed = getComputedStyle(sourceEl);

    varNames.forEach(function (name) {
        const val = computed.getPropertyValue(name);
        if (val && val.trim()) {
            targetEl.style.setProperty(name, val.trim());
        }
    });

}

// Deep-clones an element and rewrites every id inside it (plus any
// url(#id)/href="#id" references to those ids) to a unique suffix, so
// cloned SVGs (which have their own <defs> gradients/clip-paths) never
// collide with the still-present original preview's matching ids.
function cloneNodeWithUniqueIds(sourceEl) {

    const clone = sourceEl.cloneNode(true);
    const suffix = "-arr" + (arrangeCloneCounter++);
    const idMap = {};

    const withIds = [];
    if (clone.id) withIds.push(clone);
    clone.querySelectorAll("[id]").forEach(function (el) { withIds.push(el); });

    withIds.forEach(function (el) {
        const oldId = el.id;
        const newId = oldId + suffix;
        idMap[oldId] = newId;
        el.id = newId;
    });

    const allEls = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll("*")));
    const urlAttrs = ["fill", "clip-path", "filter", "mask", "stroke"];

    allEls.forEach(function (el) {

        urlAttrs.forEach(function (attr) {
            const val = el.getAttribute && el.getAttribute(attr);
            if (val && val.indexOf("url(#") === 0) {
                const oldId = val.slice(5, -1);
                if (idMap[oldId]) el.setAttribute(attr, "url(#" + idMap[oldId] + ")");
            }
        });

        const inlineStyle = el.getAttribute && el.getAttribute("style");
        if (inlineStyle && inlineStyle.indexOf("url(#") !== -1) {
            el.setAttribute("style", inlineStyle.replace(/url\(#([^)]+)\)/g, function (match, oldId) {
                return idMap[oldId] ? "url(#" + idMap[oldId] + ")" : match;
            }));
        }

        ["href", "xlink:href"].forEach(function (attr) {
            const val = el.getAttribute && el.getAttribute(attr);
            if (val && val.charAt(0) === "#") {
                const oldId = val.slice(1);
                if (idMap[oldId]) el.setAttribute(attr, "#" + idMap[oldId]);
            }
        });

    });

    return clone;

}

function cloneArrangeVisual(sourceEl) {

    if (!sourceEl) return null;
    const clone = cloneNodeWithUniqueIds(sourceEl);
    copyCssVars(sourceEl, clone, ARRANGE_PRESERVED_CSS_VARS);
    return clone;

}

// Builds the visual content for one arrangedItems entry. Returns null
// if the underlying selection no longer exists (e.g. the creator
// removed the letter after already placing it in the arrangement) -
// callers skip items that resolve to null.
function buildArrangeItemVisual(item) {

    if (item.kind === "box") {

        let source = null;
        if (giftSelections.box === "present") source = presentPreview.querySelector(".present-sprite");
        else if (giftSelections.box === "bag") source = bagPreview.querySelector(".bag-sprite");
        else if (giftSelections.box === "heart") source = heartPreview.querySelector(".heart-sprite");
        return cloneArrangeVisual(source);

    }

    if (item.kind === "flowers") {

        let source = null;
        if (giftSelections.flowers === "rose") source = roseBouquetPreview.querySelector(".bouquet-sprite");
        else if (giftSelections.flowers === "realisticRose") source = realisticRoseBouquetPreview.querySelector(".bouquet-sprite");
        else if (giftSelections.flowers === "tulips") source = tulipsBouquetPreview.querySelector(".bouquet-sprite");
        else if (giftSelections.flowers === "lilies") source = liliesBouquetPreview.querySelector(".bouquet-sprite");
        else if (giftSelections.flowers === "daisies") source = daisiesBouquetPreview.querySelector(".bouquet-sprite");
        else if (giftSelections.flowers === "sunflowers") source = sunflowersBouquetPreview.querySelector(".bouquet-sprite");
        return cloneArrangeVisual(source);

    }

    if (item.kind === "plushie") {

        let source = null;
        if (giftSelections.plushie === "teddy") source = teddyPlushiePreview.querySelector(".plushie-sprite");
        else if (giftSelections.plushie === "bunny") source = bunnyPlushiePreview.querySelector(".plushie-sprite");
        else if (giftSelections.plushie === "cat") source = catPlushiePreview.querySelector(".plushie-sprite");
        else if (giftSelections.plushie === "puppy") source = puppyPlushiePreview.querySelector(".plushie-sprite");
        return cloneArrangeVisual(source);

    }

    if (item.kind === "letter") {

        if (giftSelections.letter !== "add") return null;

        // The clone KEEPS the .letter-preview class: every paper/envelope/
        // flap/seal rule in style.css is written as ".letter-preview ...",
        // so removing the class (as this used to) stripped all of that
        // styling from the clone. Instead we reset only the things that
        // are wrong outside the live editor:
        //  - inline display (the original is display:none whenever Letter
        //    isn't the active category, and cloneNode copies that),
        //  - the fixed 280x320 box is kept at its natural size and then
        //    scaled to the item's hitbox by fitArrangeLetterClone(),
        //  - the presentAppear animation (it would override the fit
        //    transform while it runs).
        const clone = cloneNodeWithUniqueIds(letterPreview);
        clone.classList.add("arrange-letter-clone");
        clone.style.display = "block";
        clone.style.position = "absolute";
        clone.style.left = "50%";
        clone.style.top = "50%";
        clone.style.width = "280px";
        clone.style.height = "320px";
        clone.style.animation = "none";
        clone.style.cursor = "default";
        clone.style.transform = "translate(-50%, -50%)";

        // Arrange / Final Preview start the letter in the state chosen
        // under Letter State, independent of the editor preview's state.
        if (giftSelections.letterEnvelope === "yes") {
            clone.classList.add("has-envelope");
            clone.classList.toggle("letter-open", giftSelections.letterStartsOpen !== false);
        } else {
            clone.classList.remove("has-envelope", "letter-open");
        }

        const hint = clone.querySelector(".open-hint");
        if (hint) hint.remove();

        copyCssVars(letterPreview, clone, ARRANGE_PRESERVED_CSS_VARS);

        return clone;

    }

    if (item.kind === "photoStrip") {

        const strip = photoStrips.find(function (s) { return s.id === item.stripId; });
        if (!strip || strip.photos.length === 0) return null;
        return buildPhotoStripVisual(strip);

    }

    if (item.kind === "decoration") {

        const span = document.createElement("span");
        span.classList.add("arrange-decoration-glyph");
        span.textContent = item.glyph || "♥";
        applyDecorationColor(span, item);
        return span;

    }

    return null;

}

// A clone of the box's own PREVIEW WRAPPER (not just its sprite),
// used only for Final Preview - keeping the wrapper means the real
// open/close animation (".present-preview.open" etc, already defined
// in style.css) keeps working on the clone when we toggle ".open" on
// it. The Arrange canvas deliberately uses buildArrangeItemVisual's
// sprite-only clone above instead, so it can never show that
// animation while the creator is arranging.
function buildFinalPreviewBoxVisual() {

    let source = null;
    if (giftSelections.box === "present") source = presentPreview;
    else if (giftSelections.box === "bag") source = bagPreview;
    else if (giftSelections.box === "heart") source = heartPreview;
    if (!source) return null;

    const clone = cloneNodeWithUniqueIds(source);
    clone.classList.remove("open");
    clone.style.display = "block";
    clone.style.position = "relative";
    clone.style.width = "100%";
    clone.style.height = "100%";
    clone.style.cursor = "pointer";
    clone.style.animation = "none";

    const hint = clone.querySelector(".open-hint");
    if (hint) hint.remove();

    copyCssVars(source, clone, ARRANGE_PRESERVED_CSS_VARS);

    return clone;

}

// Tight-ish per-kind pixel hitboxes (against the reference canvas
// size) so the draggable area roughly matches the visible asset
// instead of every item sharing one oversized generic box - this is
// what stops a Plushie or Flowers item from accidentally grabbing/
// selecting a neighbouring item.
function getArrangeItemBoxSize(item) {

    if (item.kind === "box") return { width: 230, height: 205 };
    if (item.kind === "flowers") return { width: 150, height: 210 };
    // Matches the plushie sprites' own 200x230 viewBox proportions, so
    // the cloned artwork fills its hitbox instead of letterboxing.
    if (item.kind === "plushie") return { width: 130, height: 150 };

    if (item.kind === "letter") {
        return giftSelections.letterEnvelope === "yes"
            ? { width: 230, height: 260 }
            : { width: 200, height: 240 };
    }

    if (item.kind === "decoration") return { width: 46, height: 46 };

    if (item.kind === "photoStrip") {
        const strip = photoStrips.find(function (s) { return s.id === item.stripId; });
        return strip ? measurePhotoStripSize(strip) : { width: 140, height: 300 };
    }

    return { width: 160, height: 160 };

}

// Photo strips vary in natural size (1-3 photos, different styles), so
// rather than guess a single hardcoded box for all of them, render one
// off-screen just long enough to read its real rendered size.
const arrangePhotoStripSizeCache = {};

function measurePhotoStripSize(strip) {

    // Key on every strip property that can change the rendered size or
    // look: style, layout, frame orientation, photo count, and both
    // design variants. (This used to read a non-existent strip.design
    // and ignored layout/orientation, so a changed strip kept its old
    // hitbox size.)
    const cacheKey = [
        strip.id,
        strip.photos.length,
        strip.style || "classic",
        strip.layout || "",
        strip.frameOrientation || "square",
        strip.classicDesign || "simple",
        strip.polaroidDesign || "classic"
    ].join(":");
    if (arrangePhotoStripSizeCache[cacheKey]) return arrangePhotoStripSizeCache[cacheKey];

    const visual = buildPhotoStripVisual(strip);
    let size = { width: 140, height: 300 };

    if (visual) {
        visual.style.position = "absolute";
        visual.style.visibility = "hidden";
        visual.style.left = "-9999px";
        visual.style.top = "0";
        document.body.appendChild(visual);
        // offsetWidth/offsetHeight (layout size) rather than
        // getBoundingClientRect: the strip has an entry animation
        // (presentAppear starts at scale 0.85) that would otherwise make
        // the measured box ~15% too small.
        const w = visual.offsetWidth;
        const h = visual.offsetHeight;
        if (w && h) size = { width: w, height: h };
        document.body.removeChild(visual);
    }

    arrangePhotoStripSizeCache[cacheKey] = size;
    return size;

}

// The cloned letter keeps its natural 280x320 editor box (so the existing
// .letter-preview CSS positions the paper/envelope exactly as designed);
// this scales that box to fit the item's hitbox at the current canvas
// scale. Called from both the Arrange and Final Preview renderers.
function fitArrangeLetterClone(item, visual, boxSize, canvasScale) {

    if (!item || item.kind !== "letter" || !visual) return;

    const fit = Math.min(
        (boxSize.width * canvasScale) / 280,
        (boxSize.height * canvasScale) / 320
    );

    visual.style.transform = "translate(-50%, -50%) scale(" + fit + ")";

}

function getCanvasScale(canvasEl) {
    if (!canvasEl) return 1;
    const w = canvasEl.clientWidth || ARRANGE_REFERENCE_CANVAS_SIZE;
    return w / ARRANGE_REFERENCE_CANVAS_SIZE;
}

function getMaxMovableZ() {
    const zs = arrangedItems.filter(function (i) { return !i.fixed; }).map(function (i) { return i.z; });
    return zs.length ? Math.max.apply(null, zs) : 0;
}

// The box is the stationary foundation of the arrangement: auto-placed
// (fixed, centered) the moment Arrange Gift opens, kept in sync if the
// creator changes box type/removes the box entirely from the builder,
// and never touched by resetArrangement (that only clears the free
// arrangement, not this foundation).
const BOX_DEFAULT_PLACEMENT = {
    present: { scale: 1.15, y: 57 },
    bag: { scale: 1, y: 60 },
    heart: { scale: 1, y: 60 }
};

function ensureBoxPlaced() {

    const hasNoBoxSelected = !giftSelections.box || giftSelections.box === "none";

    if (hasNoBoxSelected) {
        arrangedItems = arrangedItems.filter(function (i) { return i.kind !== "box"; });
        return;
    }

    const placement = BOX_DEFAULT_PLACEMENT[giftSelections.box] || BOX_DEFAULT_PLACEMENT.bag;

    const existingBox = arrangedItems.find(function (i) { return i.kind === "box"; });
    if (existingBox) {
        existingBox.fixed = true;
        existingBox.z = 0;
        existingBox.scale = placement.scale;
        existingBox.y = placement.y;
        return;
    }

    arrangedItems.unshift({
        id: "arr-" + nextArrangedItemId++,
        kind: "box",
        fixed: true,
        x: 50, y: placement.y, rotation: 0, scale: placement.scale, z: 0
    });

}

// Resets only the free arrangement (positions/rotations/sizes/layers
// of everything the creator has dragged onto the canvas) - it does
// NOT touch giftSelections/photoStrips, so nothing the creator chose
// earlier (box type, flowers, photos, letter, plushie) is lost.
function resetArrangement() {

    arrangedItems = [];
    deselectArrangeItem();
    ensureBoxPlaced();
    renderYourItemsPanel();
    renderArrangeCanvas(document.getElementById("arrangeCanvas"), true);

}

function renderArrangeCanvas(canvasEl, interactive) {

    if (!canvasEl) return;

    canvasEl.innerHTML = "";
    const scale = getCanvasScale(canvasEl);

    arrangedItems
        .slice()
        .sort(function (a, b) { return a.z - b.z; })
        .forEach(function (item) {

            const visual = buildArrangeItemVisual(item);
            if (!visual) return;

            const boxSize = getArrangeItemBoxSize(item);

            const wrapper = document.createElement("div");
            wrapper.classList.add("arrange-item");
            if (item.fixed) wrapper.classList.add("fixed");
            wrapper.dataset.itemId = item.id;
            wrapper.style.left = item.x + "%";
            wrapper.style.top = item.y + "%";
            wrapper.style.width = (boxSize.width * scale) + "px";
            wrapper.style.height = (boxSize.height * scale) + "px";
            wrapper.style.zIndex = item.z;
            wrapper.style.transform =
                "translate(-50%, -50%) rotate(" + item.rotation + "deg) scale(" + item.scale + ")";

            const content = document.createElement("div");
            content.classList.add("arrange-item-content");
            fitArrangeLetterClone(item, visual, boxSize, scale);
            content.appendChild(visual);
            wrapper.appendChild(content);

            if (interactive && !item.fixed) {
                wireArrangeItemInteraction(wrapper, item);
                if (item.id === selectedArrangeItemId) {
                    wrapper.classList.add("selected");
                    addArrangeSelectionHandles(wrapper, item);
                }
            }

            canvasEl.appendChild(wrapper);

        });

    if (interactive && selectedArrangeItemId) {
        positionArrangeToolbar();
    } else {
        const toolbar = document.getElementById("arrangeItemToolbar");
        if (toolbar) toolbar.classList.remove("open");
    }

}

function wireArrangeItemInteraction(wrapper, item) {

    wrapper.addEventListener("pointerdown", function (event) {

        event.preventDefault();
        if (wrapper.setPointerCapture) {
            try { wrapper.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
        }

        const canvasEl = wrapper.parentElement;

        arrangeDragState = {
            itemId: item.id,
            moved: false,
            startPointerX: event.clientX,
            startPointerY: event.clientY,
            startX: item.x,
            startY: item.y,
            canvasRect: canvasEl.getBoundingClientRect()
        };

    });

    wrapper.addEventListener("pointermove", function (event) {

        if (!arrangeDragState || arrangeDragState.itemId !== item.id) return;

        const dxPx = event.clientX - arrangeDragState.startPointerX;
        const dyPx = event.clientY - arrangeDragState.startPointerY;

        if (Math.abs(dxPx) > 2 || Math.abs(dyPx) > 2) arrangeDragState.moved = true;

        const dxPercent = (dxPx / arrangeDragState.canvasRect.width) * 100;
        const dyPercent = (dyPx / arrangeDragState.canvasRect.height) * 100;

        item.x = Math.max(3, Math.min(97, arrangeDragState.startX + dxPercent));
        item.y = Math.max(3, Math.min(97, arrangeDragState.startY + dyPercent));

        wrapper.style.left = item.x + "%";
        wrapper.style.top = item.y + "%";
        syncArrangeSelectionBox(wrapper, item);

        if (selectedArrangeItemId === item.id) positionArrangeToolbar();

    });

    function endDrag(event) {

        if (!arrangeDragState || arrangeDragState.itemId !== item.id) return;

        const wasClick = !arrangeDragState.moved;
        arrangeDragState = null;

        if (wasClick) {
            selectArrangeItem(item.id);
        }

    }

    wrapper.addEventListener("pointerup", endDrag);
    wrapper.addEventListener("pointercancel", endDrag);

}

function selectArrangeItem(itemId) {

    const item = arrangedItems.find(function (i) { return i.id === itemId; });
    if (!item || item.fixed) {
        deselectArrangeItem();
        return;
    }

    selectedArrangeItemId = itemId;
    removeArrangeSelectionHandles();

    document.querySelectorAll("#arrangeCanvas .arrange-item").forEach(function (el) {
        const isSelected = el.dataset.itemId === itemId;
        el.classList.toggle("selected", isSelected);
        if (isSelected) addArrangeSelectionHandles(el, item);
    });

    positionArrangeToolbar();
    updateDecorationColorRow();

}

// Hides the bounding box and the floating toolbar - called whenever
// the creator taps/clicks blank canvas space, and any time the
// selected item stops existing (removed, or the screen re-renders).
function deselectArrangeItem() {

    selectedArrangeItemId = null;

    document.querySelectorAll("#arrangeCanvas .arrange-item").forEach(function (el) {
        el.classList.remove("selected");
    });
    removeArrangeSelectionHandles();

    const toolbar = document.getElementById("arrangeItemToolbar");
    if (toolbar) toolbar.classList.remove("open");

    updateDecorationColorRow();

}

// --------------------------------
// SELECTION HANDLES (Google Slides-style)
// --------------------------------
// Four corner handles resize (uniform scale about the item's centre,
// so proportions never distort) and one handle above the top edge
// rotates. They are children of the selected wrapper, so they follow
// its rotation/scale for free; --inv-scale keeps them a constant
// on-screen size regardless of the item's own scale. Layering/delete
// live in the separate floating toolbar.

const ARRANGE_HANDLE_CORNERS = ["nw", "ne", "se", "sw"];

function removeArrangeSelectionHandles() {
    document.querySelectorAll("#arrangeCanvas .arrange-selection-box").forEach(function (el) { el.remove(); });
}

// The selection box + handles live in their own top-most layer of the
// canvas (mirroring the selected item's position/size/rotation/scale),
// so no other item can ever cover a handle, regardless of layering.
function syncArrangeSelectionBox(wrapper, item) {
    const box = wrapper && wrapper._selectionBox;
    if (!box) return;
    box.style.left = wrapper.style.left;
    box.style.top = wrapper.style.top;
    box.style.width = wrapper.style.width;
    box.style.height = wrapper.style.height;
    box.style.transform = wrapper.style.transform;
    box.style.setProperty("--inv-scale", String(1 / item.scale));
}

function addArrangeSelectionHandles(wrapper, item) {

    removeArrangeSelectionHandles();

    const canvasEl = wrapper.parentElement;
    if (!canvasEl) return;

    const box = document.createElement("div");
    box.className = "arrange-selection-box";
    box.dataset.itemId = item.id;
    wrapper._selectionBox = box;

    ARRANGE_HANDLE_CORNERS.forEach(function (corner) {
        const handle = document.createElement("div");
        handle.className = "arrange-handle arrange-handle-resize handle-" + corner;
        handle.addEventListener("pointerdown", function (event) {
            startArrangeHandleDrag(event, handle, wrapper, item, "resize");
        });
        box.appendChild(handle);
    });

    const stem = document.createElement("div");
    stem.className = "arrange-rotate-stem";
    box.appendChild(stem);

    const rot = document.createElement("div");
    rot.className = "arrange-handle arrange-handle-rotate";
    rot.title = "Rotate";
    rot.addEventListener("pointerdown", function (event) {
        startArrangeHandleDrag(event, rot, wrapper, item, "rotate");
    });
    box.appendChild(rot);

    canvasEl.appendChild(box);
    syncArrangeSelectionBox(wrapper, item);

}

function startArrangeHandleDrag(event, handle, wrapper, item, mode) {

    event.preventDefault();
    event.stopPropagation();
    try { handle.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }

    const rect = wrapper.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startDist = Math.max(1, Math.hypot(event.clientX - cx, event.clientY - cy));
    const startAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
    const startScale = item.scale;
    const startRotation = item.rotation;

    function applyTransform() {
        wrapper.style.transform =
            "translate(-50%, -50%) rotate(" + item.rotation + "deg) scale(" + item.scale + ")";
        syncArrangeSelectionBox(wrapper, item);
    }

    function onMove(ev) {
        if (mode === "resize") {
            const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy);
            item.scale = Math.max(0.3, Math.min(2.5, Math.round(startScale * (dist / startDist) * 100) / 100));
        } else {
            let deg = startRotation + (Math.atan2(ev.clientY - cy, ev.clientX - cx) - startAngle) * 180 / Math.PI;
            const snapped = Math.round(deg / 15) * 15;
            if (Math.abs(deg - snapped) < 3) deg = snapped;
            item.rotation = Math.round(deg * 10) / 10;
        }
        applyTransform();
        positionArrangeToolbar();
    }

    function onUp() {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
    }

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);

}

// Layer helpers: movable items are renumbered 1..n in their current
// order first (the box stays at z 0), so forward/backward are exact
// one-step swaps even if two items previously shared a z value.
function normalizeMovableLayers() {
    arrangedItems
        .filter(function (i) { return !i.fixed; })
        .sort(function (a, b) { return a.z - b.z; })
        .forEach(function (i, idx) { i.z = idx + 1; });
}

function moveArrangeItemLayer(item, mode) {
    normalizeMovableLayers();
    const movable = arrangedItems.filter(function (i) { return !i.fixed; });
    const maxZ = movable.length;
    if (mode === "front") {
        movable.forEach(function (i) { if (i.z > item.z) i.z -= 1; });
        item.z = maxZ;
    } else if (mode === "back") {
        movable.forEach(function (i) { if (i.z < item.z) i.z += 1; });
        item.z = 1;
    } else if (mode === "forward") {
        const above = movable.find(function (i) { return i.z === item.z + 1; });
        if (above) { above.z -= 1; item.z += 1; }
    } else if (mode === "backward") {
        const below = movable.find(function (i) { return i.z === item.z - 1; });
        if (below) { below.z += 1; item.z -= 1; }
    }
}

// Wires pointerdown on the canvas element itself (and its wrap
// parent) so tapping/clicking the blank area - not any child item -
// deselects. Wired once since the canvas element itself is never
// replaced, only its contents re-rendered.
function setupArrangeCanvasDeselect() {

    if (arrangeCanvasDeselectWired) return;

    const canvasEl = document.getElementById("arrangeCanvas");
    if (!canvasEl) return;

    const wrapEl = canvasEl.closest(".arrange-canvas-wrap");

    function maybeDeselect(event) {
        if (event.target === canvasEl || event.target === wrapEl) {
            deselectArrangeItem();
        }
    }

    canvasEl.addEventListener("pointerdown", maybeDeselect);
    if (wrapEl) wrapEl.addEventListener("pointerdown", maybeDeselect);

    arrangeCanvasDeselectWired = true;

}

function positionArrangeToolbar() {

    const toolbar = document.getElementById("arrangeItemToolbar");
    if (!toolbar) return;

    const wrapper = document.querySelector(
        '#arrangeCanvas .arrange-item[data-item-id="' + selectedArrangeItemId + '"]'
    );

    if (!wrapper) {
        toolbar.classList.remove("open");
        return;
    }

    const canvasEl = document.getElementById("arrangeCanvas");
    const canvasRect = canvasEl.getBoundingClientRect();
    const itemRect = wrapper.getBoundingClientRect();

    toolbar.classList.add("open");

    let left = itemRect.left - canvasRect.left + itemRect.width / 2;
    left = Math.max(40, Math.min(canvasRect.width - 40, left));

    let top = itemRect.top - canvasRect.top - 70;
    let flipBelow = false;
    if (top < 4) {
        top = itemRect.bottom - canvasRect.top + 18;
        flipBelow = true;
    }

    toolbar.style.left = left + "px";
    toolbar.style.top = top + "px";
    toolbar.style.transform = "translateX(-50%)";
    toolbar.dataset.flipped = flipBelow ? "1" : "0";

}

const arrangeItemToolbar = document.getElementById("arrangeItemToolbar");

if (arrangeItemToolbar) {

    arrangeItemToolbar.addEventListener("click", function (event) {

        const button = event.target.closest("button[data-action]");
        if (!button || !selectedArrangeItemId) return;

        const item = arrangedItems.find(function (i) { return i.id === selectedArrangeItemId; });
        if (!item) return;

        const action = button.dataset.action;

        if (action === "front" || action === "back" || action === "forward" || action === "backward") {
            moveArrangeItemLayer(item, action);
        } else if (action === "reset") {
            item.rotation = 0;
            item.scale = 1;
        } else if (action === "rotate-left") {
            item.rotation -= 15;
        } else if (action === "rotate-right") {
            item.rotation += 15;
        } else if (action === "smaller") {
            item.scale = Math.max(0.3, Math.round((item.scale - 0.1) * 100) / 100);
        } else if (action === "bigger") {
            item.scale = Math.min(2.5, Math.round((item.scale + 0.1) * 100) / 100);
        } else if (action === "remove") {
            arrangedItems = arrangedItems.filter(function (i) { return i.id !== selectedArrangeItemId; });
            deselectArrangeItem();
            renderYourItemsPanel();
        }

        renderArrangeCanvas(document.getElementById("arrangeCanvas"), true);

    });

}

// Decoration recoloring. Text glyphs take the color directly; the bow is
// a colored emoji, so it is re-tinted with a hue-based filter instead.
// No stored color means the original appearance.
const DECORATION_COLOR_SWATCHES = ["#222222", "#E85D75", "#F29BB0", "#F2A65A", "#F2D14B", "#7FBF7F", "#6FB5E8", "#A98BD9", "#FFFFFF"];
const DECORATION_BOW_GLYPH = "\uD83C\uDF80";

function getBowTintFilter(hex) {

    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 2;
    const delta = max - min;
    const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));

    let hue = 0;
    if (delta !== 0) {
        if (max === r) hue = 60 * (((g - b) / delta + 6) % 6);
        else if (max === g) hue = 60 * ((b - r) / delta + 2);
        else hue = 60 * ((r - g) / delta + 4);
    }

    if (sat < 0.12) {
        return "grayscale(1) brightness(" + (0.3 + light * 1.7).toFixed(2) + ")";
    }

    return "grayscale(1) sepia(1) hue-rotate(" + Math.round(hue - 50) + "deg) saturate(" +
        (1.5 + sat * 3).toFixed(2) + ") brightness(" + (0.55 + light * 0.9).toFixed(2) + ")";

}

function applyDecorationColor(span, item) {

    if (!item.color) {
        span.style.color = "";
        span.style.filter = "";
        return;
    }

    if (item.glyph === DECORATION_BOW_GLYPH) {
        span.style.filter = getBowTintFilter(item.color);
    } else {
        span.style.color = item.color;
    }

}

function updateDecorationColorRow() {

    const holder = document.getElementById("arrangeDecorationColor");
    if (!holder) return;

    holder.innerHTML = "";

    const item = arrangedItems.find(function (i) { return i.id === selectedArrangeItemId; });
    if (!item || item.kind !== "decoration") {
        holder.style.display = "none";
        return;
    }

    holder.style.display = "block";
    holder.appendChild(buildStripColorRow("Color", item.color || "", DECORATION_COLOR_SWATCHES, function (color) {
        item.color = color;
        const span = document.querySelector('#arrangeCanvas .arrange-item[data-item-id="' + item.id + '"] .arrange-decoration-glyph');
        if (span) applyDecorationColor(span, item);

        // A rebuild would destroy an open custom color input mid-drag.
        const isPreset = DECORATION_COLOR_SWATCHES.some(function (c) { return c.toLowerCase() === color.toLowerCase(); });
        if (isPreset) {
            updateDecorationColorRow();
        } else {
            holder.querySelectorAll(".photo-strip-color-swatch.selected").forEach(function (el) { el.classList.remove("selected"); });
        }
    }));

}

function buildDecorationsPanel() {

    const list = document.getElementById("arrangeDecorationsList");
    if (!list) return;

    list.innerHTML = "";

    ARRANGE_DECORATION_GLYPHS.forEach(function (glyph) {

        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("arrange-decoration-option");
        button.textContent = glyph;
        button.addEventListener("click", function () {

            const item = {
                id: "arr-" + nextArrangedItemId++,
                kind: "decoration",
                glyph: glyph,
                x: 50 + (Math.random() * 16 - 8),
                y: 50 + (Math.random() * 16 - 8),
                rotation: 0,
                scale: 1,
                z: getMaxMovableZ() + 1
            };

            arrangedItems.push(item);
            renderArrangeCanvas(document.getElementById("arrangeCanvas"), true);
            selectArrangeItem(item.id);

        });

        list.appendChild(button);

    });

}


// --------------------------------
// "YOUR ITEMS" - tap-to-add
// --------------------------------
// Lists only the categories the creator actually selected AND hasn't
// placed on the canvas yet - once something's added it drops out of
// this list (and reappears if removed via the toolbar/reset).

function getYourItemsCandidates() {

    const candidates = [];

    if (giftSelections.flowers && giftSelections.flowers !== "none" &&
        !arrangedItems.some(function (i) { return i.kind === "flowers"; })) {
        candidates.push({ kind: "flowers", label: "Flowers", icon: "💐" });
    }

    if (giftSelections.plushie && giftSelections.plushie !== "none" &&
        !arrangedItems.some(function (i) { return i.kind === "plushie"; })) {
        candidates.push({ kind: "plushie", label: "Plushie", icon: "🧸" });
    }

    if (giftSelections.letter === "add" &&
        !arrangedItems.some(function (i) { return i.kind === "letter"; })) {
        candidates.push({ kind: "letter", label: "Letter", icon: "💌" });
    }

    const stripsWithPhotos = photoStrips.filter(function (s) { return s.photos.length > 0; });
    stripsWithPhotos.forEach(function (strip, index) {
        const alreadyPlaced = arrangedItems.some(function (i) {
            return i.kind === "photoStrip" && i.stripId === strip.id;
        });
        if (!alreadyPlaced) {
            candidates.push({
                kind: "photoStrip",
                stripId: strip.id,
                label: stripsWithPhotos.length > 1 ? "Photo Strip " + (index + 1) : "Photos",
                icon: "📷"
            });
        }
    });

    return candidates;

}

function renderYourItemsPanel() {

    updateLetterStatePanel();

    const list = document.getElementById("arrangeYourItemsList");
    if (!list) return;

    list.innerHTML = "";

    const candidates = getYourItemsCandidates();

    if (candidates.length === 0) {
        const empty = document.createElement("p");
        empty.className = "arrange-your-items-empty";
        empty.textContent = "Everything's on the canvas.";
        list.appendChild(empty);
        return;
    }

    candidates.forEach(function (candidate) {

        const card = document.createElement("button");
        card.type = "button";
        card.className = "arrange-your-item-card";

        const icon = document.createElement("span");
        icon.className = "arrange-your-item-icon";
        icon.textContent = candidate.icon;

        const label = document.createElement("span");
        label.textContent = candidate.label;

        card.appendChild(icon);
        card.appendChild(label);

        card.addEventListener("click", function () {
            addItemToArrangement(candidate);
        });

        list.appendChild(card);

    });

}

function addItemToArrangement(descriptor) {

    const item = {
        id: "arr-" + nextArrangedItemId++,
        kind: descriptor.kind,
        x: 50 + (Math.random() * 16 - 8),
        y: 50 + (Math.random() * 16 - 8),
        rotation: 0,
        scale: 1,
        z: getMaxMovableZ() + 1
    };

    if (descriptor.kind === "photoStrip") item.stripId = descriptor.stripId;

    arrangedItems.push(item);
    renderYourItemsPanel();
    renderArrangeCanvas(document.getElementById("arrangeCanvas"), true);
    selectArrangeItem(item.id);

}


// --------------------------------
// ARRANGE / PREVIEW SCREEN TRANSITIONS
// --------------------------------

const arrangeScreenEl = document.getElementById("arrangeScreen");
const finalPreviewScreenEl = document.getElementById("finalPreviewScreen");

function showArrangeScreen() {

    ensureBoxPlaced();

    giftCreator.style.display = "none";
    if (finalPreviewScreenEl) finalPreviewScreenEl.style.display = "none";
    if (arrangeScreenEl) arrangeScreenEl.style.display = "flex";
    setActiveScreen("arrange");

    buildDecorationsPanel();
    renderYourItemsPanel();
    deselectArrangeItem();
    renderArrangeCanvas(document.getElementById("arrangeCanvas"), true);
    setupArrangeCanvasDeselect();

}

function hideArrangeScreenToBuilder() {

    if (arrangeScreenEl) arrangeScreenEl.style.display = "none";
    giftCreator.style.display = "flex";
    setActiveScreen("create");

}

// Final Preview is read-only presentation: no selection boxes,
// toolbars, drag handles, Your Items, or Decorations controls - and
// it always starts with the box closed/focused (if there is one) so
// the open animation can play, items emerging afterward into exactly
// the positions/sizes/rotations/layers the creator arranged.
function renderFinalPreviewCanvas() {

    const canvasEl = document.getElementById("finalPreviewCanvas");
    if (!canvasEl) return;

    canvasEl.innerHTML = "";
    finalPreviewOpened = false;

    const scale = getCanvasScale(canvasEl);
    const sorted = arrangedItems.slice().sort(function (a, b) { return a.z - b.z; });
    const boxItem = sorted.find(function (i) { return i.kind === "box"; });

    const originX = boxItem ? boxItem.x : 50;
    const originY = boxItem ? Math.max(8, boxItem.y - 6) : 50;

    sorted.forEach(function (item) {

        const visual = item.kind === "box" ? buildFinalPreviewBoxVisual() : buildArrangeItemVisual(item);
        if (!visual) return;

        const boxSize = getArrangeItemBoxSize(item);
        const wrapper = document.createElement("div");
        wrapper.classList.add("arrange-item");
        if (item.kind === "box") wrapper.classList.add("fixed");
        wrapper.dataset.itemId = item.id;
        wrapper.style.width = (boxSize.width * scale) + "px";
        wrapper.style.height = (boxSize.height * scale) + "px";
        wrapper.style.zIndex = item.z;

        const content = document.createElement("div");
        content.classList.add("arrange-item-content");
        fitArrangeLetterClone(item, visual, boxSize, scale);
        content.appendChild(visual);
        wrapper.appendChild(content);

        const realTransform =
            "translate(-50%, -50%) rotate(" + item.rotation + "deg) scale(" + item.scale + ")";

        if (item.kind === "box") {

            wrapper.style.left = item.x + "%";
            wrapper.style.top = item.y + "%";
            wrapper.style.transform = realTransform;
            wrapper.style.cursor = "pointer";
            wrapper.addEventListener("click", openFinalPreviewGift);

        } else if (boxItem) {

            // Starts hidden and tiny near the box; revealFinalPreviewItems
            // travels it out to its real arranged spot once opened.
            wrapper.classList.add("final-preview-emerge");
            wrapper.style.left = originX + "%";
            wrapper.style.top = originY + "%";
            wrapper.style.opacity = "0";
            wrapper.style.transform =
                "translate(-50%, -50%) rotate(" + item.rotation + "deg) scale(" + (item.scale * 0.15) + ")";
            wrapper.dataset.finalLeft = item.x;
            wrapper.dataset.finalTop = item.y;
            wrapper.dataset.finalTransform = realTransform;

        } else {

            // No box in this gift at all - nothing to "open", so
            // everything just shows exactly as arranged.
            wrapper.style.left = item.x + "%";
            wrapper.style.top = item.y + "%";
            wrapper.style.transform = realTransform;

        }

        attachFinalPreviewZoom(wrapper, item, visual);

        canvasEl.appendChild(wrapper);

    });

    if (!boxItem) finalPreviewOpened = true;
    updateFinalPreviewMessage(finalPreviewOpened);

}

// Click-to-zoom in Final Preview: letters open (if still closed) and then
// show the full-text overlay; photo strips enlarge in the strip overlay.
// Inactive until the gift has been opened.
function attachFinalPreviewZoom(wrapper, item, visual) {

    if (item.kind === "letter") {

        wrapper.style.cursor = "pointer";
        wrapper.addEventListener("click", function () {
            if (!finalPreviewOpened) return;
            if (visual.classList.contains("has-envelope") && !visual.classList.contains("letter-open")) {
                visual.classList.add("letter-open");
                return;
            }
            letterFullPreviewOpen = true;
            renderLetterFullOverlay();
        });

    } else if (item.kind === "photoStrip") {

        const strip = photoStrips.find(function (s) { return s.id === item.stripId; });
        if (!strip) return;

        wrapper.style.cursor = "pointer";
        wrapper.addEventListener("click", function () {
            if (!finalPreviewOpened || document.getElementById("finalStripOverlay")) return;
            const overlay = buildStripOverlay(strip, function () { overlay.remove(); });
            overlay.id = "finalStripOverlay";
            document.body.appendChild(overlay);
        });

    }

}

function openFinalPreviewGift() {

    if (finalPreviewOpened) return;
    finalPreviewOpened = true;

    const canvasEl = document.getElementById("finalPreviewCanvas");
    if (!canvasEl) return;

    const boxWrapper = canvasEl.querySelector(".arrange-item.fixed");
    if (boxWrapper) {
        const inner = boxWrapper.querySelector(".present-preview, .bag-preview, .heart-preview");
        if (inner) inner.classList.add("open");
    }

    revealFinalPreviewItems(canvasEl);

}

function revealFinalPreviewItems(canvasEl) {

    const hidden = canvasEl.querySelectorAll(".final-preview-emerge");

    hidden.forEach(function (wrapper, index) {
        setTimeout(function () {
            wrapper.style.left = wrapper.dataset.finalLeft + "%";
            wrapper.style.top = wrapper.dataset.finalTop + "%";
            wrapper.style.transform = wrapper.dataset.finalTransform;
            wrapper.style.opacity = "1";
        }, 550 + index * 160);
    });

    const totalDelay = 550 + hidden.length * 160 + 500;
    setTimeout(function () { updateFinalPreviewMessage(true); }, totalDelay);

}

// The optional short personal message - blank by default, shown only
// once filled in, faded in once the gift has finished opening (or
// immediately for a container-less gift, which has nothing to open).
function updateFinalPreviewMessage(revealNow) {

    const canvasEl = document.getElementById("finalPreviewCanvas");
    if (!canvasEl) return;

    let messageEl = canvasEl.querySelector(".final-preview-message");

    if (!previewMessage || !previewMessage.trim()) {
        if (messageEl) messageEl.remove();
        return;
    }

    if (!messageEl) {
        messageEl = document.createElement("p");
        messageEl.className = "final-preview-message";
        canvasEl.appendChild(messageEl);
    }

    messageEl.textContent = previewMessage;

    if (revealNow) {
        requestAnimationFrame(function () { messageEl.classList.add("visible"); });
    } else {
        messageEl.classList.remove("visible");
    }

}

const finalPreviewMessageInput = document.getElementById("finalPreviewMessageInput");
if (finalPreviewMessageInput) {
    finalPreviewMessageInput.addEventListener("input", function () {
        previewMessage = finalPreviewMessageInput.value;
        updateFinalPreviewMessage(finalPreviewOpened);
    });
}

function showFinalPreviewScreen() {

    if (arrangeScreenEl) arrangeScreenEl.style.display = "none";
    if (finalPreviewScreenEl) finalPreviewScreenEl.style.display = "flex";
    setActiveScreen("preview");

    deselectArrangeItem();
    renderFinalPreviewCanvas();

}

function hideFinalPreviewScreenToArrange() {

    if (finalPreviewScreenEl) finalPreviewScreenEl.style.display = "none";
    showArrangeScreen();

}

const arrangeGiftButton = document.getElementById("arrangeGiftButton");
if (arrangeGiftButton) arrangeGiftButton.addEventListener("click", showArrangeScreen);

const arrangeBackButton = document.getElementById("arrangeBackButton");
if (arrangeBackButton) arrangeBackButton.addEventListener("click", hideArrangeScreenToBuilder);

const arrangePreviewButton = document.getElementById("arrangePreviewButton");
if (arrangePreviewButton) arrangePreviewButton.addEventListener("click", showFinalPreviewScreen);

const previewBackButton = document.getElementById("previewBackButton");
if (previewBackButton) previewBackButton.addEventListener("click", hideFinalPreviewScreenToArrange);

const arrangeResetButton = document.getElementById("arrangeResetButton");
if (arrangeResetButton) arrangeResetButton.addEventListener("click", resetArrangement);

// Re-render whichever of Arrange/Final Preview is currently visible on
// resize (debounced) - item pixel sizes depend on the canvas's live
// width via getCanvasScale, so a layout change (e.g. rotating a
// phone) needs a fresh render to stay correctly scaled.
let arrangeResizeTimer = null;
window.addEventListener("resize", function () {
    clearTimeout(arrangeResizeTimer);
    arrangeResizeTimer = setTimeout(function () {
        if (arrangeScreenEl && arrangeScreenEl.style.display !== "none") {
            renderArrangeCanvas(document.getElementById("arrangeCanvas"), true);
        } else if (finalPreviewScreenEl && finalPreviewScreenEl.style.display !== "none") {
            renderFinalPreviewCanvas();
        }
    }, 150);
});


// --------------------------------
// --------------------------------
// FINISH GIFT / SHARE POPUP
// --------------------------------
// There's no backend in this project yet, so the "link" is a plain
// client-side generated id. The popup/copy mechanics are fully real
// and ready to point at an actual generated URL once a save/share
// backend exists - only the id source would need to change.

function generateShareId() {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

const finishGiftButton = document.getElementById("finishGiftButton");
const sharePopupOverlay = document.getElementById("sharePopupOverlay");
const sharePopupClose = document.getElementById("sharePopupClose");
const shareLinkInput = document.getElementById("shareLinkInput");
const shareCopyButton = document.getElementById("shareCopyButton");

if (finishGiftButton) {
    finishGiftButton.addEventListener("click", function () {

        const shareLink = "https://giftbox.app/g/" + generateShareId();

        if (shareLinkInput) shareLinkInput.value = shareLink;
        if (sharePopupOverlay) sharePopupOverlay.classList.add("open");

    });
}

if (sharePopupClose) {
    sharePopupClose.addEventListener("click", function () {
        sharePopupOverlay.classList.remove("open");
    });
}

if (sharePopupOverlay) {
    sharePopupOverlay.addEventListener("click", function (event) {
        if (event.target === sharePopupOverlay) {
            sharePopupOverlay.classList.remove("open");
        }
    });
}

if (shareCopyButton) {
    shareCopyButton.addEventListener("click", function () {

        function showCopiedFeedback() {
            const original = "Copy Link";
            shareCopyButton.textContent = "Copied!";
            shareCopyButton.classList.add("copied");
            setTimeout(function () {
                shareCopyButton.textContent = original;
                shareCopyButton.classList.remove("copied");
            }, 1800);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareLinkInput.value)
                .then(showCopiedFeedback)
                .catch(function () {
                    shareLinkInput.select();
                    document.execCommand("copy");
                    showCopiedFeedback();
                });
        } else {
            shareLinkInput.select();
            document.execCommand("copy");
            showCopiedFeedback();
        }

    });
}


// --------------------------------
// MOBILE CATEGORY NAV
// --------------------------------
// Main editing screen only (never Arrange Gift, which has its own
// layout on mobile): replaces the vertical Box/Flowers/Photos/Letter/
// Plushies menu-button list with a compact "< Category >" nav. Reuses
// the existing category-switching logic (menuButtonCategoryMap,
// updatePreviewVisibility) rather than duplicating it, so it stays in
// sync with however many categories the desktop sidebar has.

const MOBILE_CATEGORY_ORDER = [
    { buttonId: "boxButton", label: "Box" },
    { buttonId: "flowersButton", label: "Flowers" },
    { buttonId: "photosButton", label: "Photos" },
    { buttonId: "letterButton", label: "Letter" },
    { buttonId: "plushiesButton", label: "Plushies" }
];

let mobileCategoryIndex = 0;

function setMobileCategory(index) {

    const count = MOBILE_CATEGORY_ORDER.length;
    mobileCategoryIndex = ((index % count) + count) % count;
    const entry = MOBILE_CATEGORY_ORDER[mobileCategoryIndex];

    const label = document.getElementById("mobileCategoryLabel");
    if (label) label.textContent = entry.label;

    dropdowns.forEach(function (item) { item.classList.remove("open"); });

    const button = document.getElementById(entry.buttonId);
    if (button) {
        const dropdown = button.nextElementSibling;
        if (dropdown) dropdown.classList.add("open");
    }

    currentPreviewCategory = menuButtonCategoryMap[entry.buttonId];
    updatePreviewVisibility();
    if (typeof renderContentItems === "function") renderContentItems();

    const scrollEl = document.querySelector(".creator-sidebar-scroll");
    if (scrollEl) scrollEl.scrollTop = 0;

}

const mobileCategoryPrev = document.getElementById("mobileCategoryPrev");
const mobileCategoryNext = document.getElementById("mobileCategoryNext");

if (mobileCategoryPrev) mobileCategoryPrev.addEventListener("click", function () {
    setMobileCategory(mobileCategoryIndex - 1);
});

if (mobileCategoryNext) mobileCategoryNext.addEventListener("click", function () {
    setMobileCategory(mobileCategoryIndex + 1);
});

if (window.matchMedia && window.matchMedia("(max-width: 860px)").matches) {
    setMobileCategory(0);
}


// --------------------------------
// INITIALIZE
// --------------------------------

selectBoxColor(giftSelections.boxColor);
selectRibbonColor(giftSelections.ribbonColor);
updateRibbonStyle();

// No category is active until the creator opens a section, and no box
// type is selected yet - this leaves the preview on its default empty
// state ("Choose something from the menu...") until they make a choice.
updatePreviewVisibility();