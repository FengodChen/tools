// Scientific Color Palettes
const scientificPalettes = {
    journal: [
        {
            name: 'Nature',
            nameKey: 'colorPicker.palettes.nature',
            colors: ['#0066CC', '#CC0000', '#009900', '#FF9900', '#9900CC', '#00CCCC', '#CC6600', '#FF6699']
        },
        {
            name: 'Science',
            nameKey: 'colorPicker.palettes.science',
            colors: ['#E41A1C', '#377EB8', '#4DAF4A', '#984EA3', '#FF7F00', '#FFFF33', '#A65628', '#F781BF']
        },
        {
            name: 'Cell',
            nameKey: 'colorPicker.palettes.cell',
            colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f']
        },
        {
            name: 'Lancet',
            nameKey: 'colorPicker.palettes.lancet',
            colors: ['#00468B', '#EC0000', '#42B440', '#0099B4', '#925E9F', '#FDAF91', '#962F7D', '#666666']
        }
    ],
    colorblind: [
        {
            name: 'Okabe-Ito',
            nameKey: 'colorPicker.palettes.okabeIto',
            description: 'Universal Design',
            colors: ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#000000']
        },
        {
            name: 'Tol Vibrant',
            nameKey: 'colorPicker.palettes.tolVibrant',
            description: 'Paul Tol',
            colors: ['#EE7733', '#0077BB', '#33BBEE', '#EE3377', '#CC3311', '#009988', '#BBBBBB']
        },
        {
            name: 'Tol Muted',
            nameKey: 'colorPicker.palettes.tolMuted',
            description: 'Paul Tol',
            colors: ['#CC6677', '#332288', '#DDCC77', '#117733', '#88CCEE', '#882255', '#44AA99', '#999933', '#AA4499']
        },
        {
            name: 'Wong',
            nameKey: 'colorPicker.palettes.wong',
            description: 'Nature Methods',
            colors: ['#000000', '#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7']
        }
    ],
    sequential: [
        {
            name: 'Viridis',
            nameKey: 'colorPicker.palettes.viridis',
            colors: ['#440154', '#31688E', '#35B779', '#FDE725']
        },
        {
            name: 'Plasma',
            nameKey: 'colorPicker.palettes.plasma',
            colors: ['#0D0887', '#7E03A8', '#CC4778', '#F89441', '#F0F921']
        },
        {
            name: 'Inferno',
            nameKey: 'colorPicker.palettes.inferno',
            colors: ['#000004', '#4A0B69', '#B63679', '#FB9E3A', '#FCFDBF']
        },
        {
            name: 'Magma',
            nameKey: 'colorPicker.palettes.magma',
            colors: ['#000004', '#3B0F70', '#8C2981', '#DE4968', '#FEDFAA']
        },
        {
            name: 'Blues',
            nameKey: 'colorPicker.palettes.blues',
            colors: ['#F7FBFF', '#C6DBEF', '#6BAED6', '#2171B5', '#08306B']
        },
        {
            name: 'Greens',
            nameKey: 'colorPicker.palettes.greens',
            colors: ['#F7FCF5', '#C7E9C0', '#74C476', '#238B45', '#00441B']
        }
    ],
    diverging: [
        {
            name: 'RdBu',
            nameKey: 'colorPicker.palettes.rdbu',
            colors: ['#B2182B', '#EF8A62', '#F7F7F7', '#67A9CF', '#2166AC']
        },
        {
            name: 'Spectral',
            nameKey: 'colorPicker.palettes.spectral',
            colors: ['#D53E4F', '#FC8D59', '#FEE08B', '#E6F598', '#99D594', '#3288BD']
        },
        {
            name: 'PiYG',
            nameKey: 'colorPicker.palettes.piyg',
            colors: ['#C51B7D', '#E9A3C9', '#FDE0EF', '#E6F5D0', '#A1D76A', '#4D9221']
        },
        {
            name: 'BrBG',
            nameKey: 'colorPicker.palettes.brbg',
            colors: ['#8C510A', '#D8B365', '#F6E8C3', '#C7EAE5', '#5AB4AC', '#01665E']
        }
    ]
};

let currentColor = { r: 79, g: 70, b: 229 };
let baseHarmonyColor = { r: 79, g: 70, b: 229 };
let currentTab = 'journal';
let currentExportTab = 'matplotlib';
let currentPalette = null;
let currentHarmonySelection = 'complementary';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await I18N.init();
    I18N.initLanguageSwitcher('.language-switcher-container');
    
    updateAllFromRGB(currentColor.r, currentColor.g, currentColor.b);
    loadSavedColors();
    renderPalettes();
    updateExportCode();
    
    selectPaletteCategory('journal');
    selectHarmonyType('complementary');
    
    document.getElementById('nativePicker').addEventListener('input', (e) => {
        const hex = e.target.value;
        const rgb = hexToRgb(hex);
        updateAllFromRGB(rgb.r, rgb.g, rgb.b);
    });
    
    document.getElementById('hexInput').addEventListener('input', handleHexInput);
    document.getElementById('rgbInput').addEventListener('input', handleRgbInput);
    document.getElementById('hslInput').addEventListener('input', handleHslInput);

    document.addEventListener('i18n:updated', () => {
        renderPalettes();
        updateExportCode();
    });
});

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    const paletteDropdown = document.getElementById('paletteDropdown');
    const harmonyDropdown = document.getElementById('harmonyDropdown');
    
    if (paletteDropdown && !paletteDropdown.contains(e.target)) {
        closePaletteDropdown();
    }
    
    if (harmonyDropdown && !harmonyDropdown.contains(e.target)) {
        closeHarmonyDropdown();
    }
});

function switchExportTab(tab) {
    currentExportTab = tab;
    const select = document.getElementById('exportSelect');
    if (select) select.value = tab;
    updateExportCode();
}

function renderPalettes() {
    const categories = ['journal', 'colorblind', 'sequential', 'diverging'];
    
    categories.forEach(category => {
        const container = document.getElementById(category + 'Palettes');
        if (!container) return;
        
        container.innerHTML = scientificPalettes[category].map((palette, index) => {
            const name = I18N.t(palette.nameKey) || palette.name;
            const desc = palette.description ? `<span class="text-xs text-slate-400 ml-2">${palette.description}</span>` : '';
            return `
                <div class="palette-card glass-panel p-3 rounded-lg border ${currentPalette === palette.name ? 'active' : ''}">
                    <div class="flex justify-between items-center mb-2 cursor-pointer" onclick="selectPalette('${category}', ${index})">
                        <span class="font-medium text-sm text-slate-700">${name}${desc}</span>
                        <span class="text-xs text-slate-400">${palette.colors.length} colors</span>
                    </div>
                    <div class="flex h-8 rounded overflow-hidden">
                        ${palette.colors.map((color, colorIndex) => `
                            <div class="flex-1 cursor-pointer hover:opacity-80 transition-opacity" 
                                 style="background-color: ${color}" 
                                 title="${color}"
                                 onclick="event.stopPropagation(); selectPaletteColor('${category}', ${index}, ${colorIndex})"></div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    });
}

function selectPalette(category, index) {
    const palette = scientificPalettes[category][index];
    currentPalette = palette.name;
    renderPalettes();
    updateExportCode();
    showToast(I18N.t('colorPicker.toast.paletteSelected') + ': ' + palette.name, 'success');
}

function selectPaletteColor(category, index, colorIndex) {
    const palette = scientificPalettes[category][index];
    const color = palette.colors[colorIndex];
    currentPalette = palette.name;
    renderPalettes();
    updateExportCode();
    selectColor(color);
    showToast(I18N.t('colorPicker.toast.colorFromPalette') + ': ' + palette.name + ' #' + (colorIndex + 1), 'success');
}

function updateExportCode() {
    const colors = currentPalette ? 
        getPaletteColors(currentPalette) : 
        [rgbToHex(currentColor.r, currentColor.g, currentColor.b)];
    
    let code = '';
    
    switch (currentExportTab) {
        case 'matplotlib':
            code = generateMatplotlibCode(colors);
            break;
        case 'latex':
            code = generateLatexCode(colors);
            break;
        case 'r':
            code = generateRCode(colors);
            break;
        case 'python':
            code = generatePythonCode(colors);
            break;
    }
    
    document.getElementById('exportCode').textContent = code;
}

function generateMatplotlibCode(colors) {
    const colorList = colors.map(c => `'${c}'`).join(', ');
    return `# Matplotlib color palette
import matplotlib.pyplot as plt

colors = [${colorList}]

# Set as default color cycle
plt.rcParams['axes.prop_cycle'] = plt.cycler(color=colors)

# Or use for specific plot
plt.plot(x, y, color=colors[0])`;
}

function generateLatexCode(colors) {
    const colorDefs = colors.map((c, i) => 
        `\\definecolor{myColor${i}}{HTML}{${c.replace('#', '').toUpperCase()}}`
    ).join('\n');
    return `% LaTeX color definitions
\\usepackage{xcolor}

${colorDefs}

% Usage example:
\\textcolor{myColor0}{Sample text}

% For TikZ/PGFPlots:
\\begin{tikzpicture}
\\begin{axis}[cycle list={${colors.map((_, i) => `{myColor${i}}`).join(', ')}}]
% Your plot commands
\\end{axis}
\\end{tikzpicture}`;
}

function generateRCode(colors) {
    const colorList = colors.map(c => `'${c}'`).join(', ');
    return `# R color palette
colors <- c(${colorList})

# For ggplot2
library(ggplot2)
ggplot(data, aes(x, y, color=category)) +
  scale_color_manual(values=colors)

# For base R plot
plot(x, y, col=colors[1])
palette(colors)`;
}

function generatePythonCode(colors) {
    const colorList = colors.map(c => `'${c}'`).join(', ');
    return `# Python color palette
colors = [${colorList}]

# For Plotly
import plotly.graph_objects as go
fig = go.Figure()
for i, color in enumerate(colors):
    fig.add_trace(go.Scatter(x=x, y=y, line=dict(color=color)))

# For Seaborn
import seaborn as sns
sns.set_palette(colors)

# For general use
print("HEX colors:", colors)`;
}

function getPaletteColors(paletteName) {
    for (const category of Object.values(scientificPalettes)) {
        const palette = category.find(p => p.name === paletteName);
        if (palette) return palette.colors;
    }
    return [];
}

function copyExportCode() {
    const code = document.getElementById('exportCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast(I18N.t('colorPicker.toast.copied'), 'success');
    });
}

function handleHexInput(e) {
    const hex = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        const rgb = hexToRgb(hex);
        updateAllFromRGB(rgb.r, rgb.g, rgb.b, 'hex');
    }
}

function handleRgbInput(e) {
    const match = e.target.value.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
        updateAllFromRGB(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), 'rgb');
    }
}

function handleHslInput(e) {
    const match = e.target.value.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
        const rgb = hslToRgb(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
        updateAllFromRGB(rgb.r, rgb.g, rgb.b, 'hsl');
    }
}

function updateAllFromRGB(r, g, b, skip = '') {
    currentColor = { r, g, b };
    const hex = rgbToHex(r, g, b);
    const hsl = rgbToHsl(r, g, b);
    const cmyk = rgbToCmyk(r, g, b);
    
    const preview = document.getElementById('colorPreview');
    preview.style.backgroundColor = hex;
    preview.textContent = hex.toUpperCase();
    preview.style.color = getContrastColor(r, g, b);
    
    if (skip !== 'hex') {
        document.getElementById('hexInput').value = hex.toUpperCase();
    }
    if (skip !== 'rgb') {
        document.getElementById('rgbInput').value = `rgb(${r}, ${g}, ${b})`;
    }
    if (skip !== 'hsl') {
        document.getElementById('hslInput').value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    }
    document.getElementById('cmykInput').value = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
    
    document.getElementById('nativePicker').value = hex;
    
    updateHarmonies(hsl);
    baseHarmonyColor = { r, g, b };
    updateHarmonyDropdownPreview();
    updateExportCode();
}

function updateHarmonies(hsl) {
    const comp = [hsl, { ...hsl, h: (hsl.h + 180) % 360 }];
    renderHarmonyColors('complementary', comp);
    
    const triadic = [hsl, { ...hsl, h: (hsl.h + 120) % 360 }, { ...hsl, h: (hsl.h + 240) % 360 }];
    renderHarmonyColors('triadic', triadic);
    
    const splitComp = [hsl, { ...hsl, h: (hsl.h + 150) % 360 }, { ...hsl, h: (hsl.h + 210) % 360 }];
    renderHarmonyColors('splitComplementary', splitComp);
    
    const tetradic = [hsl, { ...hsl, h: (hsl.h + 90) % 360 }, { ...hsl, h: (hsl.h + 180) % 360 }, { ...hsl, h: (hsl.h + 270) % 360 }];
    renderHarmonyColors('tetradic', tetradic);
    
    const analogous = [{ ...hsl, h: (hsl.h - 30 + 360) % 360 }, hsl, { ...hsl, h: (hsl.h + 30) % 360 }];
    renderHarmonyColors('analogous', analogous);
    
    const monochromatic = [
        { ...hsl, l: Math.max(10, hsl.l - 30) },
        { ...hsl, l: Math.max(20, hsl.l - 15) },
        hsl,
        { ...hsl, l: Math.min(90, hsl.l + 15) },
        { ...hsl, l: Math.min(95, hsl.l + 30) }
    ];
    renderHarmonyColors('monochromatic', monochromatic);
}

function renderHarmonyColors(containerId, colors) {
    const container = document.getElementById(containerId);
    container.innerHTML = colors.map(hsl => {
        const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        return `<div class="harmony-color harmony-color-compact border-2 border-slate-600 cursor-pointer shadow-md" 
                    style="background-color: ${hex};"
                    onclick="applyHarmonyColor('${hex}')" title="${hex}"></div>`;
    }).join('');
}

function applyHarmonyColor(hex) {
    const rgb = hexToRgb(hex);
    currentColor = { r: rgb.r, g: rgb.g, b: rgb.b };
    
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
    
    const preview = document.getElementById('colorPreview');
    preview.style.backgroundColor = hex;
    preview.textContent = hex.toUpperCase();
    preview.style.color = getContrastColor(rgb.r, rgb.g, rgb.b);
    
    document.getElementById('hexInput').value = hex.toUpperCase();
    document.getElementById('rgbInput').value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    document.getElementById('hslInput').value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    document.getElementById('cmykInput').value = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
    
    document.getElementById('nativePicker').value = hex;
    
    updateExportCode();
    showToast(I18N.t('colorPicker.toast.colorApplied'), 'success');
}

// Rich Dropdown Functions for Palette Categories
function togglePaletteDropdown() {
    const menu = document.getElementById('paletteDropdownMenu');
    const trigger = document.querySelector('#paletteDropdown .rich-dropdown-trigger');
    const arrow = document.getElementById('paletteDropdownArrow');
    
    const isOpen = menu.classList.contains('show');
    
    if (isOpen) {
        menu.classList.remove('show');
        trigger.classList.remove('active');
        arrow.style.transform = 'rotate(0deg)';
    } else {
        renderPaletteDropdown();
        menu.classList.add('show');
        trigger.classList.add('active');
        arrow.style.transform = 'rotate(180deg)';
    }
}

function renderPaletteDropdown() {
    const menu = document.getElementById('paletteDropdownMenu');
    const categories = [
        { key: 'journal', nameKey: 'colorPicker.palettes.tabs.journal', colors: scientificPalettes.journal[0].colors.slice(0, 5) },
        { key: 'colorblind', nameKey: 'colorPicker.palettes.tabs.colorblind', colors: scientificPalettes.colorblind[0].colors.slice(0, 5) },
        { key: 'sequential', nameKey: 'colorPicker.palettes.tabs.sequential', colors: scientificPalettes.sequential[0].colors.slice(0, 5) },
        { key: 'diverging', nameKey: 'colorPicker.palettes.tabs.diverging', colors: scientificPalettes.diverging[0].colors.slice(0, 5) }
    ];
    
    menu.innerHTML = categories.map(cat => {
        const name = I18N.t(cat.nameKey) || cat.key;
        const isActive = currentTab === cat.key;
        return `
            <div class="rich-dropdown-item ${isActive ? 'active' : ''}" onclick="selectPaletteCategory('${cat.key}')">
                <div class="flex justify-between items-center">
                    <span class="text-sm font-medium">${name}</span>
                </div>
                <div class="dropdown-preview-bar">
                    ${cat.colors.map(c => `<div style="background-color: ${c}"></div>`).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function selectPaletteCategory(category) {
    currentTab = category;
    
    const title = document.getElementById('paletteDropdownTitle');
    const preview = document.getElementById('paletteDropdownPreview');
    const nameKey = `colorPicker.palettes.tabs.${category}`;
    title.textContent = I18N.t(nameKey) || category;
    
    const firstPalette = scientificPalettes[category][0];
    preview.innerHTML = firstPalette.colors.slice(0, 5).map(c => 
        `<div style="background-color: ${c}"></div>`
    ).join('');
    
    closePaletteDropdown();
    
    document.querySelectorAll('.palette-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(category + 'Tab').classList.remove('hidden');
}

function closePaletteDropdown() {
    const menu = document.getElementById('paletteDropdownMenu');
    const trigger = document.querySelector('#paletteDropdown .rich-dropdown-trigger');
    const arrow = document.getElementById('paletteDropdownArrow');
    
    menu.classList.remove('show');
    trigger.classList.remove('active');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
}

// Rich Dropdown Functions for Harmony Types
function toggleHarmonyDropdown() {
    const menu = document.getElementById('harmonyDropdownMenu');
    const trigger = document.querySelector('#harmonyDropdown .rich-dropdown-trigger');
    const arrow = document.getElementById('harmonyDropdownArrow');
    
    const isOpen = menu.classList.contains('show');
    
    if (isOpen) {
        menu.classList.remove('show');
        trigger.classList.remove('active');
        arrow.style.transform = 'rotate(0deg)';
    } else {
        renderHarmonyDropdown();
        menu.classList.add('show');
        trigger.classList.add('active');
        arrow.style.transform = 'rotate(180deg)';
    }
}

function renderHarmonyDropdown() {
    const menu = document.getElementById('harmonyDropdownMenu');
    const currentHsl = rgbToHsl(baseHarmonyColor.r, baseHarmonyColor.g, baseHarmonyColor.b);
    
    const harmonies = [
        { key: 'complementary', nameKey: 'colorPicker.harmonies.complementary', descKey: 'colorPicker.harmonies.complementaryDesc', colors: [currentHsl, { ...currentHsl, h: (currentHsl.h + 180) % 360 }] },
        { key: 'triadic', nameKey: 'colorPicker.harmonies.triadic', descKey: 'colorPicker.harmonies.triadicDesc', colors: [currentHsl, { ...currentHsl, h: (currentHsl.h + 120) % 360 }, { ...currentHsl, h: (currentHsl.h + 240) % 360 }] },
        { key: 'splitComplementary', nameKey: 'colorPicker.harmonies.splitComplementary', descKey: 'colorPicker.harmonies.splitComplementaryDesc', colors: [currentHsl, { ...currentHsl, h: (currentHsl.h + 150) % 360 }, { ...currentHsl, h: (currentHsl.h + 210) % 360 }] },
        { key: 'tetradic', nameKey: 'colorPicker.harmonies.tetradic', descKey: 'colorPicker.harmonies.tetradicDesc', colors: [currentHsl, { ...currentHsl, h: (currentHsl.h + 90) % 360 }, { ...currentHsl, h: (currentHsl.h + 180) % 360 }, { ...currentHsl, h: (currentHsl.h + 270) % 360 }] },
        { key: 'analogous', nameKey: 'colorPicker.harmonies.analogous', descKey: 'colorPicker.harmonies.analogousDesc', colors: [{ ...currentHsl, h: (currentHsl.h - 30 + 360) % 360 }, currentHsl, { ...currentHsl, h: (currentHsl.h + 30) % 360 }] },
        { key: 'monochromatic', nameKey: 'colorPicker.harmonies.monochromatic', descKey: 'colorPicker.harmonies.monochromaticDesc', colors: [{ ...currentHsl, l: Math.max(10, currentHsl.l - 30) }, currentHsl, { ...currentHsl, l: Math.min(95, currentHsl.l + 30) }] }
    ];
    
    const currentHarmony = getCurrentHarmonySelection();
    
    menu.innerHTML = harmonies.map(h => {
        const name = I18N.t(h.nameKey) || h.key;
        const desc = I18N.t(h.descKey) || '';
        const isActive = currentHarmony === h.key;
        const colorHexes = h.colors.map(c => {
            const rgb = hslToRgb(c.h, c.s, c.l);
            return rgbToHex(rgb.r, rgb.g, rgb.b);
        });
        
        return `
            <div class="rich-dropdown-item ${isActive ? 'active' : ''}" onclick="selectHarmonyType('${h.key}')">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="text-sm font-medium">${name}</div>
                        <div class="text-xs text-slate-500 mt-0.5">${desc}</div>
                    </div>
                </div>
                ${colorHexes.length > 0 ? `
                    <div class="harmony-small-preview">
                        ${colorHexes.map(c => `<div style="background-color: ${c}"></div>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function getCurrentHarmonySelection() {
    return currentHarmonySelection;
}

function selectHarmonyType(harmony) {
    currentHarmonySelection = harmony;
    
    const title = document.getElementById('harmonyDropdownTitle');
    const nameKey = `colorPicker.harmonies.${harmony}`;
    title.textContent = I18N.t(nameKey) || harmony;
    
    updateHarmonyDropdownPreview();
    closeHarmonyDropdown();
    switchHarmony(harmony);
}

function closeHarmonyDropdown() {
    const menu = document.getElementById('harmonyDropdownMenu');
    const trigger = document.querySelector('#harmonyDropdown .rich-dropdown-trigger');
    const arrow = document.getElementById('harmonyDropdownArrow');
    
    menu.classList.remove('show');
    trigger.classList.remove('active');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
}

function updateHarmonyDropdownPreview() {
    const preview = document.getElementById('harmonyDropdownPreview');
    const currentHsl = rgbToHsl(baseHarmonyColor.r, baseHarmonyColor.g, baseHarmonyColor.b);
    
    let previewColors = [];
    
    switch (currentHarmonySelection) {
        case 'complementary':
            previewColors = [
                rgbToHex(baseHarmonyColor.r, baseHarmonyColor.g, baseHarmonyColor.b),
                rgbToHex(...Object.values(hslToRgb((currentHsl.h + 180) % 360, currentHsl.s, currentHsl.l)))
            ];
            break;
        case 'triadic':
            previewColors = [
                rgbToHex(baseHarmonyColor.r, baseHarmonyColor.g, baseHarmonyColor.b),
                rgbToHex(...Object.values(hslToRgb((currentHsl.h + 120) % 360, currentHsl.s, currentHsl.l))),
                rgbToHex(...Object.values(hslToRgb((currentHsl.h + 240) % 360, currentHsl.s, currentHsl.l)))
            ];
            break;
        case 'splitComplementary':
            previewColors = [
                rgbToHex(baseHarmonyColor.r, baseHarmonyColor.g, baseHarmonyColor.b),
                rgbToHex(...Object.values(hslToRgb((currentHsl.h + 150) % 360, currentHsl.s, currentHsl.l))),
                rgbToHex(...Object.values(hslToRgb((currentHsl.h + 210) % 360, currentHsl.s, currentHsl.l)))
            ];
            break;
        case 'tetradic':
            previewColors = [
                rgbToHex(baseHarmonyColor.r, baseHarmonyColor.g, baseHarmonyColor.b),
                rgbToHex(...Object.values(hslToRgb((currentHsl.h + 90) % 360, currentHsl.s, currentHsl.l))),
                rgbToHex(...Object.values(hslToRgb((currentHsl.h + 180) % 360, currentHsl.s, currentHsl.l))),
                rgbToHex(...Object.values(hslToRgb((currentHsl.h + 270) % 360, currentHsl.s, currentHsl.l)))
            ];
            break;
        case 'analogous':
            previewColors = [
                rgbToHex(...Object.values(hslToRgb((currentHsl.h - 30 + 360) % 360, currentHsl.s, currentHsl.l))),
                rgbToHex(baseHarmonyColor.r, baseHarmonyColor.g, baseHarmonyColor.b),
                rgbToHex(...Object.values(hslToRgb((currentHsl.h + 30) % 360, currentHsl.s, currentHsl.l)))
            ];
            break;
        case 'monochromatic':
            previewColors = [
                rgbToHex(...Object.values(hslToRgb(currentHsl.h, currentHsl.s, Math.max(10, currentHsl.l - 30)))),
                rgbToHex(baseHarmonyColor.r, baseHarmonyColor.g, baseHarmonyColor.b),
                rgbToHex(...Object.values(hslToRgb(currentHsl.h, currentHsl.s, Math.min(95, currentHsl.l + 30))))
            ];
            break;
    }
    
    preview.innerHTML = previewColors.map(c => `<div style="background-color: ${c}"></div>`).join('');
}

function switchHarmony(harmony) {
    if (harmony === 'all') {
        document.querySelectorAll('.harmony-section').forEach(section => {
            section.classList.remove('hidden');
        });
    } else {
        document.querySelectorAll('.harmony-section').forEach(section => {
            section.classList.add('hidden');
        });
        const selected = document.getElementById('harmony-' + harmony);
        if (selected) selected.classList.remove('hidden');
    }
}

function selectColor(hex) {
    const rgb = hexToRgb(hex);
    updateAllFromRGB(rgb.r, rgb.g, rgb.b);
}

function randomColor() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    updateAllFromRGB(r, g, b);
    showToast(I18N.t('colorPicker.toast.randomGenerated'), 'success');
}

function saveColor() {
    const hex = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
    let saved = JSON.parse(localStorage.getItem('savedColors') || '[]');
    if (!saved.includes(hex)) {
        saved.unshift(hex);
        if (saved.length > 20) saved = saved.slice(0, 20);
        localStorage.setItem('savedColors', JSON.stringify(saved));
        loadSavedColors();
        showToast(I18N.t('colorPicker.toast.colorSaved'), 'success');
    } else {
        showToast(I18N.t('colorPicker.toast.colorExists'), 'info');
    }
}

function loadSavedColors() {
    const saved = JSON.parse(localStorage.getItem('savedColors') || '[]');
    const container = document.getElementById('savedColors');
    
    if (saved.length === 0) {
        container.innerHTML = `<span class="text-slate-500 text-sm" data-i18n="colorPicker.savedColors.empty">${I18N.t('colorPicker.savedColors.empty')}</span>`;
        return;
    }
    
    container.innerHTML = saved.map(hex => 
        `<div class="saved-color-item w-10 h-10 rounded-lg border-2 border-slate-600 cursor-pointer shadow-md" 
              style="background-color: ${hex}" 
              onclick="selectColor('${hex}')" title="${hex}"></div>`
    ).join('');
}

function clearSaved() {
    localStorage.removeItem('savedColors');
    loadSavedColors();
    showToast(I18N.t('colorPicker.toast.savedCleared'), 'success');
}

async function copyValue(inputId) {
    const input = document.getElementById(inputId);
    try {
        await navigator.clipboard.writeText(input.value);
        showToast(I18N.t('colorPicker.toast.copied'), 'success');
    } catch (e) {
        showToast(I18N.t('colorPicker.toast.copyError'), 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    icon.textContent = icons[type] || icons.info;
    msg.textContent = message;
    
    toast.classList.remove('hidden');
    toast.classList.remove('translate-x-full');
    
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 2000);
}

// Color conversion functions
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToCmyk(r, g, b) {
    let c = 1 - (r / 255);
    let m = 1 - (g / 255);
    let y = 1 - (b / 255);
    let k = Math.min(c, Math.min(m, y));
    
    c = (c - k) / (1 - k) || 0;
    m = (m - k) / (1 - k) || 0;
    y = (y - k) / (1 - k) || 0;
    
    return {
        c: Math.round(c * 100),
        m: Math.round(m * 100),
        y: Math.round(y * 100),
        k: Math.round(k * 100)
    };
}

function getContrastColor(r, g, b) {
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1f2937' : '#ffffff';
}
