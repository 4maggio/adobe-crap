/**
 * Utility Functions Module
 * Provides helper functions for number handling, randomization, and string operations
 * @module utils
 */

/**
 * Rounds a number to maximum 3 decimal places
 * @param {number} n - The number to round
 * @returns {number} The rounded number
 */
function roundToMax3Decimals(n) {
    if (typeof n !== "number" || isNaN(n)) return n;
    const str = n.toString();
    const parts = str.split(".");
    if (parts.length === 2 && parts[1].length > 3) {
        return Number(n.toFixed(3));
    }
    return n;
}

/**
 * Parses a localized float input (handles comma as decimal separator)
 * @param {string|Object} inputValue - Input string or object with value property
 * @returns {number} Parsed float value
 */
function parseLocalizedFloat(inputValue) {
    if (typeof inputValue === 'object' && inputValue.value !== undefined) {
        inputValue = inputValue.value;
    }
    const str = String(inputValue || '').trim();
    // Ersetze Komma durch Punkt für lokalisierte Eingabe (deutsche Notation)
    const normalized = str.replace(',', '.');
    return parseFloat(normalized);
}

/**
 * XMur3 hash function for generating seeded random numbers
 * @param {string} str - The string to hash
 * @returns {Function} Hash function that returns seeded random generator
 */
function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
    };
}

/**
 * Mulberry32 seeded random number generator
 * @param {number} a - Seed value
 * @returns {Function} Random number generator function
 */
function mulberry32(a) {
    return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Fisher-Yates shuffle with seeded random for reproducible results
 * @param {Array} arr - Array to shuffle
 * @param {string} seedStr - Seed string for reproducible shuffles
 * @returns {void} Shuffles array in-place
 */
function seededShuffle(arr, seedStr) {
    const seedFn = xmur3(String(seedStr || ''));
    const rand = mulberry32(seedFn());
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

function getCheckedRadioValue(groupName, fallback = null) {
    if (!groupName) return fallback;
    const radios = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
    for (let i = 0; i < radios.length; i++) {
        if (radios[i] && radios[i].checked) return radios[i].value;
    }
    // fallback for environments where :checked works
    const el = document.querySelector(`input[name="${groupName}"]:checked`);
    return el ? el.value : fallback;
}

function setVisible(el, visible, shownDisplay = '') {
    if (!el) return;
    el.hidden = !visible;
    if (visible) {
        if (shownDisplay) el.style.display = shownDisplay;
        else el.style.removeProperty('display');
    } else {
        el.style.display = 'none';
    }
}

module.exports = {
    roundToMax3Decimals,
    parseLocalizedFloat,
    xmur3,
    mulberry32,
    seededShuffle,
    getCheckedRadioValue,
    setVisible
};
