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
    
    # Reserve one entire employee shift for Autopsy
    autopsy_employee = None
    reserved_hours = 3
    autopsy_idx = None
    if employees:
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
    
    # Assign all tasks except Priority Small - Mid-day
    for task_name in priority_order:
        if task_name == 'Priority Small - Mid-day':
            continue
        task = next((t for t in tasks if t['name'] == task_name), None)
        if not task or task['count'] <= 0:
            continue

        rate_per_7h = TASK_RATES.get(task_name, 1)
        count = int(task['count'])
        for idx, emp in enumerate(employees):
            if autopsy_employee and emp['id'] == autopsy_employee['id']:
                continue

            if emp in reserved_employees and task_name != 'Priority Small':
                max_assignable = working_hours - reserved_hours
            else:
                max_assignable = working_hours

            emp_hours = emp['hours']
            available_hours = max_assignable - emp_hours

            # Use integer math for task assignment
            max_tasks_for_emp = min(count, int(available_hours * rate_per_7h // 7))

            if max_tasks_for_emp > 0:
                # Calculate hours_per_task for tracking
                tasks_per_shift = rate_per_7h * working_hours // 7
                hours_per_task = working_hours / tasks_per_shift if tasks_per_shift > 0 else 0
                emp['tasks'].extend({'name': task_name, 'hours': hours_per_task} for _ in range(max_tasks_for_emp))
                emp['hours'] += hours_per_task * max_tasks_for_emp
                count -= max_tasks_for_emp
                emp['case_counts'][task_name] = emp['case_counts'].get(task_name, 0) + max_tasks_for_emp

            if count == 0:
                break
        if count > 0:
            outstanding[task_name] += count
    
    # Now assign Priority Small - Mid-day to reserved employees in their reserved hours
    task = next((t for t in tasks if t['name'] == 'Priority Small - Mid-day'), None)
    if task and task['count'] > 0:
        rate_per_7h = TASK_RATES.get('Priority Small - Mid-day', 1)
        rate = rate_per_7h * (working_hours / 7)
        hours_per_task = working_hours / rate if rate > 0 else working_hours
        count = int(task['count'])
        for emp in reserved_employees:
            if autopsy_employee and emp['id'] == autopsy_employee['id']:
                continue  # Skip autopsy reserved employee
            # Calculate available time in the reserved hours
            emp_hours = emp['hours']
            start_hours = max(emp_hours, working_hours - reserved_hours)
            available_hours = working_hours - start_hours
            max_tasks_for_emp = int(available_hours / hours_per_task)
            tasks_to_assign = min(count, max_tasks_for_emp)
            if tasks_to_assign > 0:
                emp['tasks'].extend({'name': 'Priority Small - Mid-day', 'hours': hours_per_task} for _ in range(tasks_to_assign))
                emp['hours'] = start_hours + hours_per_task * tasks_to_assign
                count -= tasks_to_assign
                emp['case_counts']['Priority Small - Mid-day'] = emp['case_counts'].get('Priority Small - Mid-day', 0) + tasks_to_assign
            if count == 0:
                break
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

def calculate_task_hours_and_overtime(tasks, available_people, working_hours, outstanding):
    total_tasks = sum(task['count'] for task in tasks)
    total_hours = 0
    overtime_by_type = {}
    for task in tasks:
        rate_per_7h = TASK_RATES.get(task['name'], 1)
        rate = rate_per_7h * (working_hours / 7)
        hours_per_task = 1 / rate * working_hours if rate > 0 else working_hours
        total_hours += task['count'] * hours_per_task
    estimated_days = math.ceil(total_hours / (available_people * working_hours)) if available_people and working_hours else 0
    total_outstanding = sum(outstanding.values())
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
    return {
        'totalTasks': total_tasks,
        'totalHours': round(total_hours, 2),
        'estimatedDays': estimated_days,
        'outstandingTasks': total_outstanding,
        'outstandingByType': outstanding,
        'overtime': overtime,
        'overtimeByType': overtime_by_type
    }

def validate_inputs(tasks, available_people, working_hours):
    if not isinstance(tasks, list):
        return False, 'Tasks must be a list.'
    if not isinstance(available_people, int) or available_people < 1:
        return False, 'Available people must be a positive integer.'
    if not isinstance(working_hours, int) or not (1 <= working_hours <= 24):
        return False, 'Working hours must be an integer between 1 and 24.'
    for task in tasks:
        if not isinstance(task, dict):
            return False, 'Each task must be a dictionary.'
        if 'name' not in task or 'count' not in task:
            return False, 'Each task must have a name and count.'
        if not isinstance(task['count'], int) or task['count'] < 0:
            return False, 'Task count must be a non-negative integer.'
    return True, ''

@app.route('/api/schedule', methods=['POST'])
def api_schedule():
    data = request.json
    tasks = data.get('tasks', [])
    available_people = int(data.get('availablePeople', 1))
    working_hours = int(data.get('workingHours', 7))
    valid, error = validate_inputs(tasks, available_people, working_hours)
    if not valid:
        return jsonify({'error': error}), 400
    employees, outstanding = distribute_tasks(tasks, available_people, working_hours)
    return jsonify({'employees': employees, 'outstanding': outstanding})

@app.route('/api/summary', methods=['POST'])
def api_summary():
    data = request.json
    tasks = data.get('tasks', [])
    available_people = int(data.get('availablePeople', 1))
    working_hours = int(data.get('workingHours', 7))
    valid, error = validate_inputs(tasks, available_people, working_hours)
    if not valid:
        return jsonify({'error': error}), 400
    employees, outstanding = distribute_tasks(tasks, available_people, working_hours)
    summary = calculate_task_hours_and_overtime(tasks, available_people, working_hours, outstanding)
    return jsonify(summary)

@app.route('/api/schedule_and_summary', methods=['POST'])
def api_schedule_and_summary():
    data = request.json
    tasks = data.get('tasks', [])
    available_people = int(data.get('availablePeople', 1))
    working_hours = int(data.get('workingHours', 7))
    valid, error = validate_inputs(tasks, available_people, working_hours)
    if not valid:
        return jsonify({'error': error}), 400
    employees, outstanding = distribute_tasks(tasks, available_people, working_hours)
    summary = calculate_task_hours_and_overtime(tasks, available_people, working_hours, outstanding)
    return jsonify({
        'employees': employees,
        'outstanding': outstanding,
        'summary': summary
    })

if __name__ == '__main__':
    print("Flask server started and print statements are working.")
    app.run(debug=True)
