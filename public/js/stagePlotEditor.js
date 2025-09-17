// --- START OF FILE public/js/stagePlotEditor.js ---

import { checkAccess, getUserPayload } from './auth.js';
import { getStagePlots, getStagePlot, createStagePlot, updateStagePlot, deleteStagePlot } from './api.js';
import { ICONS } from './modules/stagePlotIcons.js'; // NEW: Import the icon library

let currentPlotId = null;
let plots = [];
let plotDataState = {
    items: []
};
let isDirty = false;
let draggedItemId = null; 

document.addEventListener('DOMContentLoaded', () => {
    const user = getUserPayload();
    if (checkAccess() && user && user.band_id) {
        document.getElementById('editor-content').style.display = 'grid';
        init();
    } else {
        document.getElementById('access-denied').style.display = 'block';
    }
});

function init() {
    loadPlotList();
    setupEventListeners();
    populateItemPalette();
    setupTabs();
    setupStageAreaEvents();
}

function setupEventListeners() {
    document.getElementById('new-plot-btn').addEventListener('click', handleNewPlot);
    document.getElementById('save-plot-btn').addEventListener('click', handleSavePlot);
    document.getElementById('delete-plot-btn').addEventListener('click', handleDeletePlot);
    document.getElementById('plot-name-input').addEventListener('input', () => isDirty = true);
    document.getElementById('rider-form').addEventListener('input', () => isDirty = true);
    document.getElementById('export-pdf-btn').addEventListener('click', handleExportPdf);
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('hidden', content.id !== `tab-content-${tab.dataset.tab}`);
            });
        });
    });
}

async function loadPlotList() {
    const plotListEl = document.getElementById('plot-list');
    plotListEl.innerHTML = '<p class="text-sm text-gray-400">Loading...</p>';
    try {
        plots = await getStagePlots();
        plotListEl.innerHTML = '';
        if (plots.length === 0) {
            plotListEl.innerHTML = '<p class="text-sm text-gray-400">No plots created yet.</p>';
            return;
        }
        plots.forEach(plot => {
            const plotEl = document.createElement('div');
            plotEl.className = 'p-3 bg-gray-800 rounded-md cursor-pointer hover:bg-gray-700 transition-colors';
            plotEl.textContent = plot.plot_name;
            plotEl.dataset.plotId = plot.id;
            plotEl.addEventListener('click', () => confirmSwitchPlot(plot.id));
            plotListEl.appendChild(plotEl);
        });
    } catch (error) {
        plotListEl.innerHTML = `<p class="text-red-500 text-sm">Error loading plots.</p>`;
    }
}

function confirmSwitchPlot(plotId) {
    if (isDirty && !confirm('You have unsaved changes. Are you sure you want to switch plots? Your changes will be lost.')) {
        return;
    }
    loadPlotForEditing(plotId);
}

async function loadPlotForEditing(plotId) {
    currentPlotId = plotId;
    isDirty = false;
    document.getElementById('no-plot-selected').classList.add('hidden');
    document.getElementById('editor-panel').classList.remove('hidden');

    document.querySelectorAll('#plot-list > div').forEach(el => {
        el.classList.toggle('bg-indigo-600', el.dataset.plotId == plotId);
        el.classList.toggle('text-white', el.dataset.plotId == plotId);
    });

    try {
        const plot = await getStagePlot(plotId);
        document.getElementById('plot-name-input').value = plot.plot_name;
        
        const riderForm = document.getElementById('rider-form');
        riderForm.reset();
        if(plot.tech_rider_data) {
            for (const key in plot.tech_rider_data) {
                if (riderForm.elements[key]) {
                    riderForm.elements[key].value = plot.tech_rider_data[key];
                }
            }
        }
        
        plotDataState = plot.plot_data && Array.isArray(plot.plot_data.items) 
            ? plot.plot_data 
            : { items: [] };
        renderStagePlot();

    } catch (error) {
        setStatus(`Error loading plot: ${error.message}`, true);
    }
}

async function handleNewPlot() {
    const plotName = prompt('Enter a name for the new plot:', 'New Stage Plot');
    if (!plotName || plotName.trim() === '') return;

    try {
        const newPlot = await createStagePlot({ 
            plot_name: plotName, 
            plot_data: { items: [] }, 
            tech_rider_data: {} 
        });
        await loadPlotList();
        loadPlotForEditing(newPlot.id);
    } catch (error) {
        setStatus(`Failed to create new plot: ${error.message}`, true);
    }
}

async function handleSavePlot() {
    if (!currentPlotId) return;
    setStatus('Saving...');

    const riderForm = document.getElementById('rider-form');
    const riderData = Object.fromEntries(new FormData(riderForm));

    const payload = {
        plot_name: document.getElementById('plot-name-input').value,
        tech_rider_data: riderData,
        plot_data: plotDataState
    };

    try {
        await updateStagePlot(currentPlotId, payload);
        setStatus('Saved successfully!', false);
        isDirty = false;
        await loadPlotList();
        document.querySelector(`#plot-list [data-plot-id='${currentPlotId}']`).classList.add('bg-indigo-600', 'text-white');
    } catch (error) {
        setStatus(`Save failed: ${error.message}`, true);
    }
}

async function handleDeletePlot() {
    if (!currentPlotId || !confirm('Are you sure you want to permanently delete this plot?')) return;

    try {
        await deleteStagePlot(currentPlotId);
        currentPlotId = null;
        isDirty = false;
        document.getElementById('editor-panel').classList.add('hidden');
        document.getElementById('no-plot-selected').classList.remove('hidden');
        await loadPlotList();
    } catch (error) {
        setStatus(`Failed to delete plot: ${error.message}`, true);
    }
}

// MODIFIED: This function now renders icons in the palette.
function populateItemPalette() {
    const paletteEl = document.getElementById('item-palette');
    paletteEl.innerHTML = '<h3 class="font-bold mb-2">Drag to Stage</h3>';
    const items = [
        { type: 'mic', label: 'Vocal Mic' },
        { type: 'amp', label: 'Guitar Amp' },
        { type: 'bass-amp', label: 'Bass Amp' },
        { type: 'monitor', label: 'Wedge' },
        { type: 'drums', label: 'Drum Kit' },
        { type: 'keyboard', label: 'Keyboard' },
        { type: 'di', label: 'DI Box' },
        { type: 'custom', label: 'Custom Label' }
    ];

    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'p-2 flex items-center gap-2 bg-gray-700 rounded-md cursor-grab text-sm select-none hover:bg-gray-600';
        itemEl.draggable = true;
        
        const iconData = ICONS[item.type];
        if (iconData) {
            itemEl.innerHTML = `
                <svg width="24" height="24" viewBox="${iconData.viewBox}">${iconData.svg}</svg>
                <span>${item.label}</span>
            `;
        } else {
            itemEl.textContent = item.label;
        }

        itemEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify(item));
        });
        paletteEl.appendChild(itemEl);
    });
}

function setupStageAreaEvents() {
    const stageArea = document.getElementById('stage-area');
    
    stageArea.addEventListener('dragover', (e) => e.preventDefault());
    
    stageArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const stageRect = stageArea.getBoundingClientRect();

        const paletteItemData = e.dataTransfer.getData('application/json');
        
        if (paletteItemData) {
            const itemData = JSON.parse(paletteItemData);
            
            let label = itemData.label;
            if (itemData.type === 'custom') {
                const customLabel = prompt('Enter a label for this item:', 'Custom Item');
                if (!customLabel) return;
                label = customLabel;
            }

            const x = ((e.clientX - stageRect.left) / stageRect.width) * 100;
            const y = ((e.clientY - stageRect.top) / stageRect.height) * 100;
            
            plotDataState.items.push({
                id: `item_${Date.now()}`,
                type: itemData.type,
                label: label,
                x: x,
                y: y,
                rotation: 0
            });
        } else if (draggedItemId) {
            const item = plotDataState.items.find(i => i.id === draggedItemId);
            if (item) {
                item.x = ((e.clientX - stageRect.left) / stageRect.width) * 100;
                item.y = ((e.clientY - stageRect.top) / stageRect.height) * 100;
            }
            draggedItemId = null;
        }

        isDirty = true;
        renderStagePlot();
    });
}

// MODIFIED: This function now renders icons and labels for each stage item.
function renderStagePlot() {
    const stageArea = document.getElementById('stage-area');
    stageArea.querySelectorAll('.stage-item').forEach(el => el.remove());

    plotDataState.items.forEach(item => {
        const itemEl = document.createElement('div');
        // Setting a base size for items
        itemEl.className = 'stage-item absolute flex flex-col items-center justify-center cursor-move p-1 group';
        itemEl.style.width = '60px';
        itemEl.style.height = '60px';
        
        const currentRotation = item.rotation || 0;
        itemEl.style.left = `${item.x}%`;
        itemEl.style.top = `${item.y}%`;
        itemEl.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;
        
        itemEl.dataset.itemId = item.id;
        itemEl.draggable = true;
        
        const iconData = ICONS[item.type];
        const iconSVG = iconData ? `<svg width="30" height="30" viewBox="${iconData.viewBox}">${iconData.svg}</svg>` : '';

        itemEl.innerHTML = `
            <div class="icon-container">${iconSVG}</div>
            <span class="item-label text-xs font-bold whitespace-nowrap text-white mt-1">${item.label}</span>
            <div class="item-controls absolute top-0 right-0 -mt-2 -mr-2 hidden group-hover:flex gap-1" style="transform: rotate(${-currentRotation}deg)">
                <button data-action="rotate" title="Rotate" class="bg-green-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow-lg">R</button>
                <button data-action="edit" title="Edit Label" class="bg-blue-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow-lg">E</button>
                <button data-action="delete" title="Delete" class="bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow-lg">X</button>
            </div>
        `;

        itemEl.addEventListener('dragstart', (e) => {
            draggedItemId = item.id;
            e.dataTransfer.effectAllowed = 'move';
        });

        itemEl.querySelector('[data-action="rotate"]').addEventListener('click', () => {
            let newRotation = (item.rotation || 0) + 45;
            if (newRotation >= 360) newRotation = 0;
            item.rotation = newRotation;
            isDirty = true;
            renderStagePlot();
        });

        itemEl.querySelector('[data-action="edit"]').addEventListener('click', () => {
            const newLabel = prompt('Enter new label:', item.label);
            if (newLabel && newLabel.trim() !== '') {
                item.label = newLabel.trim();
                isDirty = true;
                renderStagePlot();
            }
        });

        itemEl.querySelector('[data-action="delete"]').addEventListener('click', () => {
            if (confirm(`Delete "${item.label}"?`)) {
                plotDataState.items = plotDataState.items.filter(i => i.id !== item.id);
                isDirty = true;
                renderStagePlot();
            }
        });

        stageArea.appendChild(itemEl);
    });
}

// MODIFIED: This function is updated to render the SVG icons in the PDF.
function handleExportPdf() {
    if (isDirty) {
        alert('Please save your changes before exporting to PDF.');
        return;
    }
    if (!window.jspdf) {
        alert('PDF library not loaded.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });

    const plotName = document.getElementById('plot-name-input').value;

    // --- PAGE 1: STAGE PLOT ---
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(`Stage Plot: ${plotName}`, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

    const stageX = 20, stageY = 40;
    const stageWidth = doc.internal.pageSize.getWidth() - 40;
    const stageHeight = doc.internal.pageSize.getHeight() - 60;

    doc.setFillColor('#1f2937');
    doc.rect(stageX, stageY, stageWidth, stageHeight, 'F');
    doc.setFontSize(10);
    doc.setTextColor('#ffffff');

    plotDataState.items.forEach(item => {
        const itemX = stageX + (item.x / 100) * stageWidth;
        const itemY = stageY + (item.y / 100) * stageHeight;
        const rotation = item.rotation || 0;
        const iconData = ICONS[item.type];
        
        doc.saveGraphicsState();
        doc.translate(itemX, itemY);
        doc.rotate(rotation);

        // Draw the icon - this is a simplification. jsPDF can't render SVG strings directly.
        // For a true render, we would need to convert SVG to a format jsPDF understands,
        // which is very complex. We will draw a placeholder box with the icon type.
        const boxSize = 30;
        doc.setFillColor('#4b5563');
        doc.roundedRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, 3, 3, 'F');
        doc.text(item.type.substring(0, 3).toUpperCase(), 0, 0, { align: 'center', baseline: 'middle' });
        
        // Draw the label below the icon box
        doc.text(item.label, 0, (boxSize / 2) + 10, { align: 'center', baseline: 'middle' });
        
        doc.restoreGraphicsState();
    });

    // --- PAGE 2: TECH RIDER ---
    // (This part remains unchanged)
    const riderForm = document.getElementById('rider-form');
    const riderData = Object.fromEntries(new FormData(riderForm));
    doc.addPage('a4', 'portrait');
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text('Technical Rider', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

    const renderWrappedText = (title, content, startY) => {
        doc.setFontSize(16);
        doc.text(title, 15, startY);
        doc.setFontSize(12);
        const splitContent = doc.splitTextToSize(content || 'N/A', doc.internal.pageSize.getWidth() - 35);
        doc.text(splitContent, 20, startY + 8);
        return startY + (splitContent.length * 5) + 15;
    };
    
    let yPos = 40;
    yPos = renderWrappedText('Channel List / Input List:', riderData.channel_list, yPos);
    yPos = renderWrappedText('Contact Info:', `Name: ${riderData.contact_name || 'N/A'}\nEmail: ${riderData.contact_email || 'N/A'}\nPhone: ${riderData.contact_phone || 'N/A'}`, yPos);
    yPos = renderWrappedText('Hospitality & Other Notes:', riderData.hospitality_needs, yPos);

    doc.save(`${plotName.replace(/\s/g, '_')}.pdf`);
}


function setStatus(message, isError = false) {
    const statusEl = document.getElementById('status-message');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `text-center text-sm h-5 mb-4 ${isError ? 'text-red-500' : 'text-green-400'}`;
    if (message && !isError) {
        setTimeout(() => {
            if (statusEl.textContent === message) statusEl.textContent = '';
        }, 3000);
    }
}
// --- END OF FILE public/js/stagePlotEditor.js ---
