// Project Assignments Scheduling Tool - JS+Python API version
let tasks = [];
let priorityScheduleChart;
const API_BASE = 'http://localhost:5000/api';

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
    canvas.height = 300;
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
                            let label = `${dataset.label}: ${hours?.toFixed ? hours.toFixed(2) : 0} hours`;
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
        window.priorityScheduleChart.data.labels = employees.length > 0 ? employees.map(emp => `PA ${emp.id}`) : ["PA 1"];
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
    });
}
