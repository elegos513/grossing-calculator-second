// Project Assignments Scheduling Tool - JS+Python API version
let tasks = [];
let priorityScheduleChart;
let routineScheduleChart;

// Use local API if running on localhost, otherwise use production
const API_BASE =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:5000/api"
        : "https://grossing-calculator-second.onrender.com/api";

const TASK_STRUCTURE = {
    Priority: [
        { id: 'prioritySmall', label: 'Priority Small' },
        { id: 'priorityBreast', label: 'Priority Breast' },
        { id: 'prioritySarcoma', label: 'Priority Sarcoma' },
        { id: 'priorityGi', label: 'Priority GI' },
        { id: 'priorityGyne', label: 'Priority Gyne' },
        { id: 'priorityHeadNeck', label: 'Priority Head + Neck' },
        { id: 'priorityMiscellaneous', label: 'Priority Miscellaneous' },
        { id: 'nicuPlacentas', label: 'NICU Placentas' },
        { id: 'prioritySmallMidday', label: 'Priority Small - Mid-day' }
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
        // Add routine chart below priority chart
        if (!document.getElementById('routineScheduleChartContainer')) {
            const routineCard = document.createElement('div');
            routineCard.className = 'card mb-4';
            routineCard.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">Routine Schedule</h5>
                    <div id="routineScheduleChartContainer" style="min-height: 450px;"></div>
                </div>
            `;
            const container = document.querySelector('.container');
            const priorityCard = document.getElementById('priorityScheduleChartContainer').closest('.card');
            if (priorityCard && priorityCard.nextSibling) {
                container.insertBefore(routineCard, priorityCard.nextSibling);
            } else {
                container.appendChild(routineCard);
            }
        }
        initializeRoutineChart();
        updateRoutineChart();
    }, 100);

    // Prevent form submission from reloading the page
    const form = document.getElementById('taskForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!validateInputs()) return;
        collectTasks();
        updatePriorityChart();
        updateRoutineChart();
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
        updateRoutineChart();
    });
    document.getElementById('workingHours').addEventListener('input', function() {
        if (!validateInputs()) return;
        updatePriorityChart();
        updateRoutineChart();
    });
});

function renderTaskInputs() {
    const taskInputs = document.getElementById('taskInputs');
    // Clear existing content
    taskInputs.innerHTML = '';

    // Priority Section
    let priorityHeader = document.createElement('h5');
    priorityHeader.textContent = 'Priority';
    priorityHeader.className = 'text-center fw-bold';
    taskInputs.appendChild(priorityHeader);
    let priorityRow = document.createElement('div');
    priorityRow.className = 'row';
    TASK_STRUCTURE.Priority.forEach((sub, index) => {
        if (index % 4 === 0 && index !== 0) {
            taskInputs.appendChild(priorityRow);
            priorityRow = document.createElement('div');
            priorityRow.className = 'row';
        }
        const col = document.createElement('div');
        col.className = 'col-md-3 mb-3';
        col.innerHTML = `
            <label for="${sub.id}" class="form-label">${sub.label}</label>
            <input type="number" class="form-control" id="${sub.id}" min="0" value="0">
        `;
        priorityRow.appendChild(col);
    });
    taskInputs.appendChild(priorityRow);

    // Routine Section
    let routineHeader = document.createElement('h5');
    routineHeader.textContent = 'Routine';
    routineHeader.className = 'text-center fw-bold';
    taskInputs.appendChild(routineHeader);
    let routineRow = document.createElement('div');
    routineRow.className = 'row';
    TASK_STRUCTURE.Routine.forEach((sub, index) => {
        if (index % 4 === 0 && index !== 0) {
            taskInputs.appendChild(routineRow);
            routineRow = document.createElement('div');
            routineRow.className = 'row';
        }
        const col = document.createElement('div');
        col.className = 'col-md-3 mb-3';
        col.innerHTML = `
            <label for="${sub.id}" class="form-label">${sub.label}</label>
            <input type="number" class="form-control" id="${sub.id}" min="0" value="0">
        `;
        routineRow.appendChild(col);
    });
    taskInputs.appendChild(routineRow);
}

function validateInputs() {
    let valid = true;
    let errorMsg = '';
    // Validate availablePeople
    const people = document.getElementById('availablePeople');
    if (!people.value || isNaN(people.value) || parseInt(people.value) < 1) {
        valid = false;
        errorMsg = 'Available People must be a positive integer.';
        people.classList.add('is-invalid');
    } else {
        people.classList.remove('is-invalid');
    }
    // Validate workingHours
    const hours = document.getElementById('workingHours');
    if (!hours.value || isNaN(hours.value) || parseInt(hours.value) < 1 || parseInt(hours.value) > 24) {
        valid = false;
        errorMsg = 'Working Hours must be between 1 and 24.';
        hours.classList.add('is-invalid');
    } else {
        hours.classList.remove('is-invalid');
    }
    // Validate all Priority subcategory inputs
    TASK_STRUCTURE.Priority.forEach(sub => {
        const el = document.getElementById(sub.id);
        if (!el.value || isNaN(el.value) || parseInt(el.value) < 0) {
            valid = false;
            errorMsg = 'All task counts must be 0 or a positive integer.';
            el.classList.add('is-invalid');
        } else {
            el.classList.remove('is-invalid');
        }
    });
    // Validate all Routine subcategory inputs
    TASK_STRUCTURE.Routine.forEach(sub => {
        const el = document.getElementById(sub.id);
        if (!el.value || isNaN(el.value) || parseInt(el.value) < 0) {
            valid = false;
            errorMsg = 'All task counts must be 0 or a positive integer.';
            el.classList.add('is-invalid');
        } else {
            el.classList.remove('is-invalid');
        }
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
    if (!valid) {
        errorDiv.textContent = errorMsg;
        errorDiv.style.display = 'block';
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
    // Fix: Only call destroy if the previous chart is a Chart instance
    if (window.priorityScheduleChart && typeof window.priorityScheduleChart.destroy === 'function') {
        window.priorityScheduleChart.destroy();
    }
    const defaultLabels = ["PA 1"];
    const defaultDatasets = TASK_STRUCTURE.Priority.map(sub => ({
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
                            const hours = dataset.data[index];
                            // Show count for each task (except Autopsy Reserved)
                            let label = `${dataset.label}: ${hours?.toFixed ? hours.toFixed(2) : 0} hours`;
                            if (dataset.label !== 'Autopsy Reserved' && window.priorityScheduleChart && window.priorityScheduleChart.data && window.priorityScheduleChart.data.labels) {
                                // Find the employee index
                                const empIdx = index;
                                // Find the employee data from the last API call
                                if (window.lastEmployees && window.lastEmployees[empIdx]) {
                                    const emp = window.lastEmployees[empIdx];
                                    // Find the count for this task
                                    const count = emp.case_counts && emp.case_counts[dataset.label] ? emp.case_counts[dataset.label] : 0;
                                    label += `, ${count} assigned`;
                                }
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function updatePriorityChart() {
    collectTasks();
    fetch(`${API_BASE}/schedule`, {
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
        // Store employees globally for tooltip access
        window.lastEmployees = employees;
        if (employees.length === 0) {
            window.priorityScheduleChart.data.labels = ["PA 1"];
            window.priorityScheduleChart.data.datasets = TASK_STRUCTURE.Priority.map(sub => ({
                label: sub.label,
                data: [0],
                backgroundColor: '#888',
                stack: 'Stack 0',
                borderWidth: 1
            }));
            window.priorityScheduleChart.update();
            // Also update summary to show zero state
            updateDailySummary();
            return;
        }
        const colors = {
            'Priority Small': '#3498db',
            'Priority Breast': '#e67e22',
            'Priority Sarcoma': '#9b59b6',
            'Priority GI': '#1abc9c',
            'Priority Gyne': '#e74c3c',
            'Priority Head + Neck': '#34495e',
            'Priority Miscellaneous': '#f1c40f',
            'NICU Placentas': '#2ecc71',
            'Priority Small - Mid-day': '#d35400'
        };
        const datasets = TASK_STRUCTURE.Priority.map(sub => ({
            label: sub.label,
            data: employees.map(emp => emp.tasks.filter(t => t.name === sub.label).reduce((sum, t) => sum + t.hours, 0)),
            backgroundColor: colors[sub.label] || '#888',
            stack: 'Stack 0',
            borderWidth: 1
        }));
        // Add reserved bar for last 3 employees (mid-day reserved) as the lowest priority (last dataset)
        let reservedBar = new Array(employees.length).fill(0);
        if (employees.length >= 3) {
            const reservedHours = 3;
            for (let i = employees.length - 3; i < employees.length; i++) {
                reservedBar[i] = reservedHours;
            }
            datasets.push({
                label: 'Reserved for Priority Small - Mid-day',
                data: reservedBar,
                backgroundColor: '#b3c6ff',
                stack: 'Stack 0',
                borderWidth: 1
            });
        }
        // Add autopsy reserved bar for the autopsy employee
        let autopsyIdx = null;
        if (employees.length >= 4) {
            autopsyIdx = employees.length - 4;
        } else if (employees.length > 0) {
            autopsyIdx = employees.length - 1;
        }
        if (autopsyIdx !== null && autopsyIdx >= 0) {
            const autopsyBar = new Array(employees.length).fill(0);
            autopsyBar[autopsyIdx] = parseFloat(document.getElementById('workingHours').value) || 7;
            datasets.unshift({
                label: 'Autopsy Reserved',
                data: autopsyBar,
                backgroundColor: '#888888',
                stack: 'Stack 0',
                borderWidth: 1
            });
        }
        window.priorityScheduleChart.data.labels = employees.length > 0 ? employees.map((emp, idx) => {
            if (idx === autopsyIdx) {
                return `PA ${emp.id} (Autopsy Reserved)`;
            }
            return `PA ${emp.id}`;
        }) : ["PA 1"];
        window.priorityScheduleChart.data.datasets = datasets.length > 0 ? datasets : [
            {
                label: 'No Priority Tasks',
                data: new Array(window.priorityScheduleChart.data.labels.length).fill(0),
                backgroundColor: '#ccc',
                stack: 'Stack 0',
                borderWidth: 1
            }
        ];
        window.priorityScheduleChart.update();
        updateDailySummary();
    })
    .catch(() => {
        window.priorityScheduleChart.data.labels = ["PA 1"];
        window.priorityScheduleChart.data.datasets = TASK_STRUCTURE.Priority.map(sub => ({
            label: sub.label,
            data: [0],
            backgroundColor: '#888',
            stack: 'Stack 0',
            borderWidth: 1
        }));
        window.priorityScheduleChart.update();
        updateDailySummary();
    });
}

function initializeRoutineChart() {
    const container = document.getElementById('routineScheduleChartContainer');
    if (!container) {
        console.error('Container for routineScheduleChart not found.');
        return;
    }
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'routineScheduleChart';
    canvas.width = 600;
    canvas.height = 450;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (window.routineScheduleChart && typeof window.routineScheduleChart.destroy === 'function') {
        window.routineScheduleChart.destroy();
    }
    const defaultLabels = ["PA 1"];
    const defaultDatasets = TASK_STRUCTURE.Routine.map(sub => ({
        label: sub.label,
        data: [0],
        backgroundColor: '#888',
        stack: 'Stack 0',
        borderWidth: 1
    }));
    window.routineScheduleChart = new Chart(ctx, {
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
                            const hours = dataset.data[index];
                            let label = `${dataset.label}: ${hours?.toFixed ? hours.toFixed(2) : 0} hours`;
                            if (window.lastEmployees && window.lastEmployees[index]) {
                                const emp = window.lastEmployees[index];
                                const count = emp.case_counts && emp.case_counts[dataset.label] ? emp.case_counts[dataset.label] : 0;
                                label += `, ${count} assigned`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function updateRoutineChart() {
    collectTasks();
    fetch(`${API_BASE}/schedule`, {
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
        if (employees.length === 0) {
            window.routineScheduleChart.data.labels = ["PA 1"];
            window.routineScheduleChart.data.datasets = TASK_STRUCTURE.Routine.map(sub => ({
                label: sub.label,
                data: [0],
                backgroundColor: '#888',
                stack: 'Stack 0',
                borderWidth: 1
            }));
            window.routineScheduleChart.update();
            return;
        }
        const colors = {
            'Routine Small': '#3498db',
            'Routine Breast': '#e67e22',
            'Routine GI': '#1abc9c',
            'Routine Gyne': '#e74c3c',
            'Routine Head + Neck': '#34495e',
            'Routine Miscellaneous': '#f1c40f',
            'Routine Placenta': '#2ecc71',
            'Non Tumour Bones': '#d35400'
        };
        const datasets = TASK_STRUCTURE.Routine.map(sub => ({
            label: sub.label,
            data: employees.map(emp => emp.tasks.filter(t => t.name === sub.label).reduce((sum, t) => sum + t.hours, 0)),
            backgroundColor: colors[sub.label] || '#888',
            stack: 'Stack 0',
            borderWidth: 1
        }));
        window.routineScheduleChart.data.labels = employees.length > 0 ? employees.map((emp, idx) => `PA ${emp.id}`) : ["PA 1"];
        window.routineScheduleChart.data.datasets = datasets.length > 0 ? datasets : [
            {
                label: 'No Routine Tasks',
                data: new Array(window.routineScheduleChart.data.labels.length).fill(0),
                backgroundColor: '#ccc',
                stack: 'Stack 0',
                borderWidth: 1
            }
        ];
        window.routineScheduleChart.update();
    })
    .catch(() => {
        window.routineScheduleChart.data.labels = ["PA 1"];
        window.routineScheduleChart.data.datasets = TASK_STRUCTURE.Routine.map(sub => ({
            label: sub.label,
            data: [0],
            backgroundColor: '#888',
            stack: 'Stack 0',
            borderWidth: 1
        }));
        window.routineScheduleChart.update();
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
    fetch(`${API_BASE}/summary`, {
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
            'Priority Small - Mid-day',
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
