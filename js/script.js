// Project Assignments Scheduling Tool - JS+Python API version
let tasks = [];

// Use only the hosted API URL
const API_BASE = 'https://grossing-calculator-second.onrender.com';  //uncomment this line before deploying
//const API_BASE = 'http://127.0.0.1:5000';  // Uncomment this line when testing locally

const TASK_STRUCTURE = {
    Priority: [
        { id: 'prioritySmall', label: 'Priority Small' },
        { id: 'priorityBreast', label: 'Priority Breast' },
        { id: 'prioritySarcoma', label: 'Priority Sarcoma' },
        { id: 'priorityGi', label: 'Priority GI' },
        { id: 'priorityGyne', label: 'Priority Gyne' },
        { id: 'priorityHeadNeck', label: 'Priority Head + Neck' },
        { id: 'priorityMiscellaneous', label: 'Priority Miscellaneous' },
        { id: 'nicuPlacentas', label: 'NICU Placentas' }
    ],
    Routine: [
        { id: 'routineSmall', label: 'Routine Small' },
        { id: 'routineBreast', label: 'Routine Breast' },
        { id: 'routineGi', label: 'Routine GI' },
        { id: 'routineGyne', label: 'Routine Gyne' },
        { id: 'routineHeadNeck', label: 'Routine Head + Neck' },
        { id: 'routineMiscellaneous', label: 'Routine Miscellaneous' },
        { id: 'routinePlacenta', label: 'Routine Placenta' },
        { id: 'nonTumourBones', label: 'Non Tumour Bones' }
    ]
};

document.addEventListener('DOMContentLoaded', function () {
    renderTaskInputs();
    // Wait for DOM and taskInputs to be rendered before initializing chart
    setTimeout(() => {
        initializePriorityChart();
        updatePriorityChart();
        addExportPDFButton();
    }, 100);

    // Prevent form submission from reloading the page
    const form = document.getElementById('taskForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!validateInputs()) return;
        collectTasks();
        updatePriorityChart();
    });
    // Prevent Enter key from submitting the form and resetting values
    form.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    });
    document.getElementById('availablePeople').addEventListener('input', function() {
        if (!validateInputs()) return;
        updatePriorityChart();
    });
    document.getElementById('workingHours').addEventListener('input', function() {
        if (!validateInputs()) return;
        updatePriorityChart();
    });
});

function renderSection(sectionName, sectionData) {
    const taskInputs = document.getElementById('taskInputs');
    let header = document.createElement('h5');
    header.textContent = sectionName;
    header.className = 'text-center fw-bold';
    taskInputs.appendChild(header);
    let row = document.createElement('div');
    row.className = 'row';
    sectionData.forEach((sub, index) => {
        if (index % 4 === 0 && index !== 0) {
            taskInputs.appendChild(row);
            row = document.createElement('div');
            row.className = 'row';
        }
        const col = document.createElement('div');
        col.className = 'col-md-3 mb-3';
        col.innerHTML = `
            <label for="${sub.id}" class="form-label">${sub.label}</label>
            <input type="number" class="form-control" id="${sub.id}" min="0" value="0">
        `;
        row.appendChild(col);
    });
    taskInputs.appendChild(row);
}

function renderTaskInputs() {
    const taskInputs = document.getElementById('taskInputs');
    taskInputs.innerHTML = '';
    renderSection('Priority', TASK_STRUCTURE.Priority);
    renderSection('Routine', TASK_STRUCTURE.Routine);
}

function validateInputField(el, validator, errorMsg) {
    if (!validator(el.value)) {
        el.classList.add('is-invalid');
        return errorMsg;
    } else {
        el.classList.remove('is-invalid');
        return '';
    }
}

function validateInputs() {
    let valid = true;
    let errorMsg = '';
    // Validate availablePeople
    const people = document.getElementById('availablePeople');
    errorMsg = validateInputField(
        people,
        v => v && !isNaN(v) && parseInt(v) >= 1,
        'Available People must be a positive integer.'
    ) || errorMsg;
    // Validate workingHours
    const hours = document.getElementById('workingHours');
    errorMsg = validateInputField(
        hours,
        v => v && !isNaN(v) && parseInt(v) >= 1 && parseInt(v) <= 24,
        'Working Hours must be between 1 and 24.'
    ) || errorMsg;
    // Validate all Priority and Routine subcategory inputs
    [...TASK_STRUCTURE.Priority, ...TASK_STRUCTURE.Routine].forEach(sub => {
        const el = document.getElementById(sub.id);
        errorMsg = validateInputField(
            el,
            v => v !== '' && !isNaN(v) && parseInt(v) >= 0,
            'All task counts must be 0 or a positive integer.'
        ) || errorMsg;
    });
    // Show error message if invalid
    let errorDiv = document.getElementById('inputError');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'inputError';
        errorDiv.className = 'alert alert-danger mt-3';
        const container = document.querySelector('.container');
        container.insertBefore(errorDiv, container.firstChild.nextSibling);
    }
    if (errorMsg) {
        errorDiv.textContent = errorMsg;
        errorDiv.style.display = 'block';
        valid = false;
    } else {
        errorDiv.style.display = 'none';
    }
    return valid;
}

function collectTasks() {
    tasks = [];
    TASK_STRUCTURE.Priority.forEach(sub => {
        const val = parseInt(document.getElementById(sub.id).value) || 0;
        if (val > 0) tasks.push({ name: sub.label, count: val, category: 'Priority' });
    });
    TASK_STRUCTURE.Routine.forEach(sub => {
        const val = parseInt(document.getElementById(sub.id).value) || 0;
        if (val > 0) tasks.push({ name: sub.label, count: val, category: 'Routine' });
    });
}

function initializePriorityChart() {
    // Remove any existing canvas
    const container = document.getElementById('priorityScheduleChartContainer');
    if (!container) {
        console.error('Container for priorityScheduleChart not found.');
        return;
    }
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'priorityScheduleChart';
    // Set explicit width/height to avoid 0x0 canvas
    canvas.width = 600;
    canvas.height = 450;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (window.priorityScheduleChart && typeof window.priorityScheduleChart.destroy === 'function') {
        window.priorityScheduleChart.destroy();
    }
    const defaultLabels = ["PA 1"];
    // Combine both Priority and Routine for default datasets
    const defaultDatasets = [...TASK_STRUCTURE.Priority, ...TASK_STRUCTURE.Routine].map(sub => ({
        label: sub.label,
        data: [0],
        backgroundColor: '#888',
        stack: 'Stack 0',
        borderWidth: 1
    }));
    window.priorityScheduleChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: defaultLabels, datasets: defaultDatasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: true } },
            scales: {
                x: { beginAtZero: true, title: { display: true, text: 'Hours Assigned' }, stacked: true },
                y: { stacked: true }
            },
            plugins: {
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataset = context.dataset;
                            const index = context.dataIndex;
                            if (window.priorityScheduleChart && window.priorityScheduleChart.data && window.priorityScheduleChart.data.labels) {
                                const empIdx = index;
                                if (window.lastEmployees && window.lastEmployees[empIdx]) {
                                    const emp = window.lastEmployees[empIdx];
                                    const count = emp.case_counts && emp.case_counts[dataset.label] ? emp.case_counts[dataset.label] : 0;
                                    return `${dataset.label}: ${count} assigned`;
                                }
                            }
                            return `${dataset.label}: 0 assigned`;
                        }
                    }
                }
            }
        }
    });
}

function updatePriorityChart() {
    collectTasks();
    fetch(`${API_BASE}/api/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tasks,
            availablePeople: document.getElementById('availablePeople').value,
            workingHours: document.getElementById('workingHours').value
        })
    })
    .then(res => res.json())
    .then(data => {
        const employees = data.employees || [];
        window.lastEmployees = employees;
        if (employees.length === 0) {
            window.priorityScheduleChart.data.labels = ["PA 1"];
            window.priorityScheduleChart.data.datasets = [...TASK_STRUCTURE.Priority, ...TASK_STRUCTURE.Routine].map(sub => ({
                label: sub.label,
                data: [0],
                backgroundColor: '#888',
                stack: 'Stack 0',
                borderWidth: 1
            }));
            window.priorityScheduleChart.update();
            // Enable export button only if there is data (at least one nonzero bar)
            setExportPDFButtonEnabled(false);
            updateDailySummary();
            return;
        }
        // Priority color scheme
        const priorityColors = {
            'Priority Small': '#3498db',
            'Priority Breast': '#e67e22',
            'Priority Sarcoma': '#9b59b6',
            'Priority GI': '#1abc9c',
            'Priority Gyne': '#e74c3c',
            'Priority Head + Neck': '#34495e',
            'Priority Miscellaneous': '#f1c40f',
            'NICU Placentas': '#2ecc71'
        };
        // Routine: use a pattern/texture
        // We'll use Chart.js pattern plugin if available, or fallback to semi-transparent colors
        // For now, use diagonal stripes via CanvasPattern if available, else fallback
        function makePattern(color) {
            const size = 8;
            const patternCanvas = document.createElement('canvas');
            patternCanvas.width = size;
            patternCanvas.height = size;
            const pctx = patternCanvas.getContext('2d');
            pctx.fillStyle = color;
            pctx.fillRect(0, 0, size, size);
            pctx.strokeStyle = 'rgba(0,0,0,0.15)';
            pctx.lineWidth = 2;
            pctx.beginPath();
            pctx.moveTo(0, size);
            pctx.lineTo(size, 0);
            pctx.stroke();
            return pctx.createPattern(patternCanvas, 'repeat');
        }
        const routineColors = {
            'Routine Small': '#3498db',
            'Routine Breast': '#e67e22',
            'Routine GI': '#1abc9c',
            'Routine Gyne': '#e74c3c',
            'Routine Head + Neck': '#34495e',
            'Routine Miscellaneous': '#f1c40f',
            'Routine Placenta': '#2ecc71',
            'Non Tumour Bones': '#d35400'
        };
        // Build datasets: Priority (solid color), Routine (pattern)
        const datasets = [
            ...TASK_STRUCTURE.Priority.map(sub => ({
                label: sub.label,
                data: employees.map(emp => emp.tasks.filter(t => t.name === sub.label).reduce((sum, t) => sum + t.hours, 0)),
                backgroundColor: priorityColors[sub.label] || '#888',
                stack: 'Stack 0',
                borderWidth: 1
            })),
            ...TASK_STRUCTURE.Routine.map(sub => ({
                label: sub.label,
                data: employees.map(emp => emp.tasks.filter(t => t.name === sub.label).reduce((sum, t) => sum + t.hours, 0)),
                backgroundColor: makePattern(routineColors[sub.label] || '#888'),
                stack: 'Stack 0',
                borderWidth: 1
            }))
        ];
        // Add Autopsy bar if any PA has Autopsy assigned
        const hasAutopsy = employees.some(emp => emp.tasks.some(t => t.name === 'Autopsy'));
        if (hasAutopsy) {
            datasets.push({
                label: 'Autopsy',
                data: employees.map(emp => emp.tasks.filter(t => t.name === 'Autopsy').reduce((sum, t) => sum + t.hours, 0)),
                backgroundColor: '#888888',
                stack: 'Stack 0',
                borderWidth: 1
            });
        }
        window.priorityScheduleChart.data.labels = employees.length > 0 ? employees.map((emp, idx) => `PA ${emp.id}`) : ["PA 1"];
        window.priorityScheduleChart.data.datasets = datasets.length > 0 ? datasets : [
            {
                label: 'No Tasks',
                data: new Array(window.priorityScheduleChart.data.labels.length).fill(0),
                backgroundColor: '#ccc',
                stack: 'Stack 0',
                borderWidth: 1
            }
        ];
        window.priorityScheduleChart.update();
        // Enable export button only if there is data (at least one nonzero bar)
        const hasData = datasets.some(ds => Array.isArray(ds.data) && ds.data.some(val => val > 0));
        setExportPDFButtonEnabled(hasData);
        updateDailySummary();
    })
    .catch(() => {
        window.priorityScheduleChart.data.labels = ["PA 1"];
        window.priorityScheduleChart.data.datasets = [...TASK_STRUCTURE.Priority, ...TASK_STRUCTURE.Routine].map(sub => ({
            label: sub.label,
            data: [0],
            backgroundColor: '#888',
            stack: 'Stack 0',
            borderWidth: 1
        }));
        window.priorityScheduleChart.update();
        setExportPDFButtonEnabled(false);
        updateDailySummary();
    });
}

// Daily summary card and chart update logic
// Only add the Daily Summary section if it doesn't already exist
if (!document.getElementById('dailySummaryCard')) {
    const summaryCard = document.createElement('div');
    summaryCard.className = 'card mb-4';
    summaryCard.id = 'dailySummaryCard';
    summaryCard.innerHTML = `
        <div class="card-body">
            <h5 class="card-title">Daily Summary</h5>
            <div id="dailySummaryContent">
                <div class="text-muted">Loading summary...</div>
            </div>
        </div>
    `;
    const container = document.querySelector('.container');
    const chartCard = document.getElementById('priorityScheduleChartContainer').closest('.card');
    if (chartCard && chartCard.nextSibling) {
        container.insertBefore(summaryCard, chartCard.nextSibling);
    } else {
        container.appendChild(summaryCard);
    }
}

// Fetch and render the summary
function updateDailySummary() {
    fetch(`${API_BASE}/api/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tasks,
            availablePeople: document.getElementById('availablePeople').value,
            workingHours: document.getElementById('workingHours').value
        })
    })
    .then(res => res.json())
    .then(data => {
        const content = document.getElementById('dailySummaryContent');
        if (!content) return;
        // Color logic for overtime, days, and outstanding tasks
        const overtimeColor = data.overtime > 0 ? 'text-danger' : 'text-success';
        const daysColor = data.estimatedDays > 1 ? 'text-warning' : 'text-success';
        const outstandingColor = data.outstandingTasks > 0 ? 'text-danger' : 'text-success';
        // Build breakdowns for outstanding and overtime by type
        const taskOrder = [
            'Priority Small',
            'Priority Breast',
            'Priority Sarcoma',
            'Priority GI',
            'Priority Gyne',
            'Priority Head + Neck',
            'Priority Miscellaneous',
            'NICU Placentas',
            'Routine Small',
            'Routine Breast',
            'Routine GI',
            'Routine Gyne',
            'Routine Head + Neck',
            'Routine Miscellaneous',
            'Routine Placenta',
            'Non Tumour Bones'
        ];
        let outstandingBreakdown = '';
        let overtimeBreakdown = '';
        let hasOutstanding = false;
        let hasOvertime = false;
        taskOrder.forEach(type => {
            if (data.outstandingByType && typeof data.outstandingByType[type] !== 'undefined' && data.outstandingByType[type] > 0) {
                outstandingBreakdown += `<div class='small'>${type}: <span class='fw-bold'>${data.outstandingByType[type]}</span></div>`;
                hasOutstanding = true;
            }
            if (data.overtimeByType && typeof data.overtimeByType[type] !== 'undefined' && data.overtimeByType[type] > 0) {
                overtimeBreakdown += `<div class='small'>${type}: <span class='fw-bold'>${data.overtimeByType[type]}</span> hours</div>`;
                hasOvertime = true;
            }
        });
        content.innerHTML = `
            <div class="d-flex justify-content-around flex-wrap text-center">
                <div class="p-2 flex-fill">
                    <div class="fs-2 fw-bold">${data.totalTasks}</div>
                    <div class="small text-muted">Total Tasks</div>
                </div>
                <div class="p-2 flex-fill">
                    <div class="fs-2 fw-bold">${data.totalHours}</div>
                    <div class="small text-muted">Total Hours</div>
                </div>
                <div class="p-2 flex-fill">
                    <div class="fs-2 fw-bold ${daysColor}">${data.estimatedDays}</div>
                    <div class="small text-muted">Estimated Days to Complete</div>
                </div>
                <div class="p-2 flex-fill">
                    <div class="fs-2 fw-bold ${outstandingColor}">${data.outstandingTasks}</div>
                    <div class="small text-muted">Outstanding Tasks</div>
                    ${hasOutstanding ? `<div class="mt-2 text-center">${outstandingBreakdown}</div>` : ''}
                </div>
                <div class="p-2 flex-fill">
                    <div class="fs-2 fw-bold ${overtimeColor}">${data.overtime}</div>
                    <div class="small text-muted">Overtime Required (hours)</div>
                    ${hasOvertime ? `<div class="mt-2 text-center">${overtimeBreakdown}</div>` : ''}
                </div>
            </div>
        `;
    })
    .catch(() => {
        const content = document.getElementById('dailySummaryContent');
        if (content) content.innerHTML = '<div class="text-danger">Failed to load summary.</div>';
    });
}
// Initial call
updateDailySummary();

// Add Export to PDF button below the chart
function addExportPDFButton() {
    let btn = document.getElementById('exportPDFBtn');
    if (!btn) {
        const chartCard = document.getElementById('priorityScheduleChartContainer').closest('.card');
        const btnDiv = document.createElement('div');
        btnDiv.className = 'text-end mb-2';
        btnDiv.innerHTML = `<button id="exportPDFBtn" class="btn btn-secondary" disabled>Export Chart to PDF</button>`;
        chartCard.insertBefore(btnDiv, chartCard.lastElementChild.nextSibling);
        btn = document.getElementById('exportPDFBtn');
        btn.addEventListener('click', exportChartToPDF);
    }
    // No need to set btn.disabled here; chart update logic will handle it
}

// Enable or disable the export button based on chart data
function setExportPDFButtonEnabled(enabled) {
    const btn = document.getElementById('exportPDFBtn');
    if (btn) {
        btn.disabled = !enabled;
        if (enabled) {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
        } else {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        }
    }
}

// Export chart to PDF using html2canvas and jsPDF
function exportChartToPDF() {
    const chartContainer = document.getElementById('priorityScheduleChartContainer');
    if (!chartContainer) return;
    // Wait for libraries to load if needed
    function doExport() {
        const canvasElem = chartContainer.querySelector('canvas');
        if (!canvasElem) return;
        window.html2canvas(canvasElem).then(canvas => {
            // jsPDF v2+ uses window.jspdf.jsPDF
            const jsPDF = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const imgWidth = pageWidth - 40;
            const imgHeight = canvas.height * (imgWidth / canvas.width);
            pdf.text('Daily Pathologist Assistant Assignment', 40, 40);
            pdf.addImage(imgData, 'PNG', 40, 60, imgWidth, imgHeight);
            pdf.save('PA_Assignment_Chart.pdf');
        });
    }
    // Wait for html2canvas and jsPDF to be loaded
    function waitForLibs(cb) {
        if (window.html2canvas && ((window.jspdf && window.jspdf.jsPDF) || window.jsPDF)) {
            cb();
        } else {
            setTimeout(() => waitForLibs(cb), 200);
        }
    }
    waitForLibs(doExport);
}

// Add CDN scripts for html2canvas and jsPDF if not present
(function ensurePDFDeps() {
    if (!window.html2canvas) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        document.head.appendChild(s);
    }
    if (!window.jspdf && !window.jsPDF) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
        document.head.appendChild(s);
    }
})();
