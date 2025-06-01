from flask import Flask, request, jsonify
from flask_cors import CORS
import math

app = Flask(__name__)
CORS(app)

# Task rates per 7-hour day (can be adjusted for other working hours)
TASK_RATES = {
    'Priority Small': 80,
    'Priority Small - Mid-day': 80,
    'Priority Breast': 5,
    'Priority Sarcoma': 5,
    'Priority GI': 5,
    'Priority Gyne': 5,
    'Priority Head + Neck': 5,
    'Priority Miscellaneous': 80,
    'NICU Placentas': 10,
    'Routine Small': 80,
    'Routine Breast': 5,
    'Routine GI': 5,
    'Routine Gyne': 5,
    'Routine Head + Neck': 5,
    'Routine Miscellaneous': 80,
    'Routine Placenta': 10,
    'Non Tumour Bones': 10
}

def distribute_tasks(tasks, available_people, working_hours):
    if not tasks or available_people < 1:
        return [], {}
    employees = [
        {'id': i + 1, 'tasks': [], 'hours': 0, 'reserved_priority_small': 0, 'case_counts': {}}
        for i in range(available_people)
    ]
    outstanding = {task['name']: 0 for task in tasks}
    priority_order = [
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
    ]
    # Reserve one entire employee shift for Autopsy (display only, do not assign any other cases to this employee)
    autopsy_employee = None
    reserved_hours = 3
    autopsy_idx = None
    if employees:
        # Autopsy employee is just before the last 3 (mid-day reserved) employees
        if len(employees) >= 4:
            autopsy_idx = len(employees) - 4
            autopsy_employee = employees[autopsy_idx]
            autopsy_employee['autopsy_reserved'] = True
        else:
            autopsy_idx = len(employees) - 1
            autopsy_employee = employees[autopsy_idx]
            autopsy_employee['autopsy_reserved'] = True
    # Mid-day reserved employees are the last 3
    reserved_employees = employees[-3:] if len(employees) >= 3 else employees
    for emp in reserved_employees:
        emp['reserved_priority_small'] = reserved_hours
    # Assign all tasks except Priority Small - Mid-day, and skip autopsy employee
    for task_name in priority_order:
        if task_name == 'Priority Small - Mid-day':
            continue
        task = next((t for t in tasks if t['name'] == task_name), None)
        if not task or task['count'] <= 0:
            continue
        rate_per_7h = TASK_RATES.get(task_name, 1)
        rate = rate_per_7h * (working_hours / 7)
        hours_per_task = 1 / rate * working_hours if rate > 0 else working_hours
        count = int(task['count'])
        for idx, emp in enumerate(employees):
            if autopsy_employee and emp['id'] == autopsy_employee['id']:
                continue  # Skip autopsy reserved employee for all assignments
            # For reserved employees, only allow up to (working_hours - reserved_hours) for non-Mid-day tasks
            if emp in reserved_employees and task_name != 'Priority Small':
                max_assignable = working_hours - reserved_hours
            else:
                max_assignable = working_hours
            available_hours = max_assignable - emp['hours']
            while count > 0 and available_hours >= hours_per_task and emp['hours'] + hours_per_task <= max_assignable:
                emp['tasks'].append({'name': task_name, 'hours': hours_per_task})
                emp['hours'] += hours_per_task
                available_hours -= hours_per_task
                count -= 1
                # Track case count
                emp['case_counts'][task_name] = emp['case_counts'].get(task_name, 0) + 1
            if count == 0:
                break
        if count > 0:
            outstanding[task_name] += count
    # Now assign Priority Small - Mid-day to reserved employees in their reserved hours (the last 3 hours), but skip autopsy employee
    task = next((t for t in tasks if t['name'] == 'Priority Small - Mid-day'), None)
    if task and task['count'] > 0:
        rate_per_7h = TASK_RATES.get('Priority Small - Mid-day', 1)
        rate = rate_per_7h * (working_hours / 7)
        hours_per_task = 1 / rate * working_hours if rate > 0 else working_hours
        count = int(task['count'])
        for emp in reserved_employees:
            if autopsy_employee and emp['id'] == autopsy_employee['id']:
                continue  # Skip autopsy reserved employee
            emp_hours_for_special = max(emp['hours'], working_hours - reserved_hours)
            available_hours = working_hours - emp_hours_for_special
            temp_hours = emp_hours_for_special
            while count > 0 and available_hours >= hours_per_task and temp_hours + hours_per_task <= working_hours:
                emp['tasks'].append({'name': 'Priority Small - Mid-day', 'hours': hours_per_task})
                temp_hours += hours_per_task
                available_hours -= hours_per_task
                count -= 1
                # Track case count
                emp['case_counts']['Priority Small - Mid-day'] = emp['case_counts'].get('Priority Small - Mid-day', 0) + 1
            emp['hours'] = temp_hours
        if count > 0:
            outstanding['Priority Small - Mid-day'] += count
    # Remove all tasks from autopsy reserved employee and set their hours to working_hours
    if autopsy_employee:
        autopsy_employee['tasks'] = []
        autopsy_employee['hours'] = working_hours
        autopsy_employee['case_counts'] = {}
    # Return case_counts in the employee dicts
    return [
        {k: v for k, v in emp.items() if k not in ('reserved_priority_small', 'autopsy_reserved')}
        for emp in employees
    ], outstanding

@app.route('/api/schedule', methods=['POST'])
def api_schedule():
    data = request.json
    tasks = data.get('tasks', [])
    available_people = int(data.get('availablePeople', 1))
    working_hours = int(data.get('workingHours', 7))
    employees, outstanding = distribute_tasks(tasks, available_people, working_hours)
    return jsonify({'employees': employees, 'outstanding': outstanding})

@app.route('/api/summary', methods=['POST'])
def api_summary():
    data = request.json
    tasks = data.get('tasks', [])
    available_people = int(data.get('availablePeople', 1))
    working_hours = int(data.get('workingHours', 7))
    total_tasks = sum(task['count'] for task in tasks)
    total_hours = 0
    overtime_by_type = {}
    for task in tasks:
        rate_per_7h = TASK_RATES.get(task['name'], 1)
        rate = rate_per_7h * (working_hours / 7)
        hours_per_task = 1 / rate * working_hours if rate > 0 else working_hours
        total_hours += task['count'] * hours_per_task
    estimated_days = math.ceil(total_hours / (available_people * working_hours)) if available_people and working_hours else 0
    # Calculate outstanding tasks
    _, outstanding = distribute_tasks(tasks, available_people, working_hours)
    total_outstanding = sum(outstanding.values())
    # Overtime required to finish outstanding tasks (per category)
    overtime = 0
    for task in tasks:
        name = task['name']
        outstanding_count = outstanding.get(name, 0)
        if outstanding_count > 0:
            rate_per_7h = TASK_RATES.get(name, 1)
            rate = rate_per_7h * (working_hours / 7)
            hours_per_task = 1 / rate * working_hours if rate > 0 else working_hours
            overtime_by_type[name] = round(outstanding_count * hours_per_task, 2)
            overtime += outstanding_count * hours_per_task
        else:
            overtime_by_type[name] = 0
    overtime = round(overtime, 2)
    return jsonify({
        'totalTasks': total_tasks,
        'totalHours': round(total_hours, 2),
        'estimatedDays': estimated_days,
        'outstandingTasks': total_outstanding,
        'outstandingByType': outstanding,
        'overtime': overtime,
        'overtimeByType': overtime_by_type
    })

if __name__ == '__main__':
    app.run(debug=True)
