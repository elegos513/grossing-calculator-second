from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import math
import os

app = Flask(__name__)
CORS(app)

# Serve static files
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('css', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('js', filename)

# Task rates per 6.5-hour day (can be adjusted for other working hours)
TASK_RATES = {
    'Priority Small': 80,
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
    
    # Create a deep copy of tasks to avoid modifying the original
    import copy
    tasks_copy = copy.deepcopy(tasks)
    
    employees = [
        {'id': i + 1, 'tasks': [], 'hours': 0, 'case_counts': {}}
        for i in range(available_people)
    ]
    outstanding = {task['name']: 0 for task in tasks_copy}
    priority_order = [
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
    ]
    
    # Reserve the last two PAs for autopsy (assign their entire shift to autopsy and exclude from other assignments)
    # But exclude PA 3 from autopsy consideration since PA 3 has special Prep assignment
    autopsy_count = 2 if len(employees) >= 2 else len(employees)
    autopsy_employees = []
    assignment_employees = []
    
    for i, emp in enumerate(employees):
        # Last two PAs go to autopsy, but PA 3 is excluded (PA 3 gets Prep instead)
        if len(employees) - i <= autopsy_count and emp['id'] != 3:
            autopsy_employees.append(emp)
        else:
            assignment_employees.append(emp)
    
    for emp in autopsy_employees:
        emp['tasks'] = [{'name': 'Autopsy', 'hours': working_hours}]
        emp['hours'] = working_hours
        # Don't include autopsy in case_counts since it's not part of the input tasks
        emp['case_counts'] = {}

    # Reserve the second half of PA 3's shift for Prep (if PA 3 exists in assignment_employees)
    pa3 = next((emp for emp in assignment_employees if emp['id'] == 3), None)
    if pa3:
        prep_hours = working_hours / 2  # Second half of the shift
        pa3['tasks'].append({'name': 'Prep', 'hours': prep_hours})
        pa3['hours'] += prep_hours

    # Pre-allocate tasks for PA 3's first half to ensure they get regular tasks
    # This happens before the main assignment loops
    if pa3:
        # PA 3 can work 3.25 hours (first half) for regular tasks
        pa3_available_hours = working_hours / 2
        
        # Try to assign tasks to PA 3 first, going through priority order
        for task_name in priority_order:
            # Skip Priority Small (reserved for PA 1)
            if task_name == 'Priority Small':
                continue
                
            task = next((t for t in tasks_copy if t['name'] == task_name), None)
            if not task or task['count'] <= 0:
                continue
                
            rate_per_6_5h = TASK_RATES.get(task_name, 1)
            
            # Calculate how many tasks PA 3 can handle in their first half
            max_tasks_for_pa3 = int(pa3_available_hours * rate_per_6_5h // 6.5)
            tasks_to_assign = min(task['count'], max_tasks_for_pa3)
            
            if tasks_to_assign > 0:
                # Calculate hours per task for tracking
                tasks_per_shift = rate_per_6_5h * working_hours / 6.5
                hours_per_task = working_hours / tasks_per_shift if tasks_per_shift > 0 else 0
                
                # Assign tasks to PA 3
                pa3['tasks'].extend({'name': task_name, 'hours': hours_per_task} for _ in range(tasks_to_assign))
                pa3['hours'] += hours_per_task * tasks_to_assign
                pa3['case_counts'][task_name] = pa3['case_counts'].get(task_name, 0) + tasks_to_assign
                
                # Reduce the available task count
                task['count'] -= tasks_to_assign
                
                # Update available hours for PA 3
                pa3_available_hours -= hours_per_task * tasks_to_assign
                
                # If PA 3's first half is full, stop
                if pa3_available_hours <= 0:
                    break

    # Step 1: Assign Priority Small to PA 1 for their full shift and fill remaining time
    priority_small_task = next((t for t in tasks_copy if t['name'] == 'Priority Small'), None)
    if priority_small_task and priority_small_task['count'] > 0:
        rate_per_6_5h = TASK_RATES.get('Priority Small', 1)
        count = int(priority_small_task['count'])
        
        # Find PA 1 specifically (first employee in assignment_employees)
        pa1 = assignment_employees[0] if assignment_employees else None
        
        if pa1:
            # Calculate maximum tasks PA 1 can handle (should be 80 for 6.5 hour shift)
            max_assignable = working_hours
            available_hours = max_assignable - pa1['hours']
            pa1_max_capacity = int(available_hours * rate_per_6_5h // 6.5)
            max_tasks_for_emp = min(count, pa1_max_capacity)
            
            if max_tasks_for_emp > 0:
                # Calculate hours per task: working_hours / max_capacity_for_this_working_hours
                tasks_per_shift = rate_per_6_5h * working_hours / 6.5
                hours_per_task = working_hours / tasks_per_shift if tasks_per_shift > 0 else 0
                pa1['tasks'].extend({'name': 'Priority Small', 'hours': hours_per_task} for _ in range(max_tasks_for_emp))
                pa1['hours'] += hours_per_task * max_tasks_for_emp
                count -= max_tasks_for_emp
                pa1['case_counts']['Priority Small'] = pa1['case_counts'].get('Priority Small', 0) + max_tasks_for_emp
                pa1['priority_small_dedicated'] = True  # Mark this employee as dedicated Priority Small
                
                # Update the task count for remaining assignments
                priority_small_task['count'] = count
            
            # Fill PA 1's remaining time with Available Time to ensure they're completely reserved
            if pa1['hours'] < working_hours:
                remaining_time = working_hours - pa1['hours']
                pa1['tasks'].append({'name': 'Available Time', 'hours': remaining_time})
                pa1['hours'] = working_hours

    # Step 2: Assign all Priority tasks (including remaining Priority Small)
    # For Priority Small overflow: assign to next available PAs (excluding PA 1)
    for task_name in priority_order:
        # Only process Priority tasks in this step
        if not task_name.startswith('Priority') and task_name != 'NICU Placentas':
            continue
            
        task = next((t for t in tasks_copy if t['name'] == task_name), None)
        if not task or task['count'] <= 0:
            continue

        rate_per_6_5h = TASK_RATES.get(task_name, 1)
        count = int(task['count'])
        for idx, emp in enumerate(assignment_employees):
            # For Priority Small: skip PA 1 since they're already assigned their capacity
            # For other Priority tasks: skip PA 1 since they're completely reserved for Priority Small
            if emp['id'] == assignment_employees[0]['id']:
                continue

            max_assignable = working_hours
            # For PA 3, they can only be assigned regular tasks for the first half of their shift
            # The second half is already reserved for Prep
            if emp['id'] == 3:
                max_assignable = working_hours / 2  # Only first half available for regular tasks
                # But emp['hours'] already includes the Prep time, so we need to adjust
                prep_hours = working_hours / 2
                # Available hours for regular tasks = first half - (current hours - prep hours)
                emp_regular_hours = emp['hours'] - prep_hours if emp['hours'] >= prep_hours else emp['hours']
                available_hours = max_assignable - emp_regular_hours
            else:
                emp_hours = emp['hours']
                available_hours = max_assignable - emp_hours

            if emp['id'] != 3:  # For non-PA3, use the original calculation
                # Use integer math for task assignment
                max_tasks_for_emp = min(count, int(available_hours * rate_per_6_5h // 6.5))
            else:  # For PA 3, use the adjusted available_hours
                max_tasks_for_emp = min(count, int(available_hours * rate_per_6_5h // 6.5))

            if max_tasks_for_emp > 0:
                # Calculate hours_per_task for tracking
                tasks_per_shift = rate_per_6_5h * working_hours / 6.5
                hours_per_task = working_hours / tasks_per_shift if tasks_per_shift > 0 else 0
                emp['tasks'].extend({'name': task_name, 'hours': hours_per_task} for _ in range(max_tasks_for_emp))
                emp['hours'] += hours_per_task * max_tasks_for_emp
                count -= max_tasks_for_emp
                emp['case_counts'][task_name] = emp['case_counts'].get(task_name, 0) + max_tasks_for_emp

            if count == 0:
                break
        if count > 0:
            outstanding[task_name] += count
    
    # Step 3: Assign all Routine tasks
    # Exclude PA 1 (completely reserved for Priority Small)
    for task_name in priority_order:
        if not task_name.startswith('Routine'):
            continue
        task = next((t for t in tasks_copy if t['name'] == task_name), None)
        if not task or task['count'] <= 0:
            continue

        rate_per_6_5h = TASK_RATES.get(task_name, 1)
        count = int(task['count'])
        for idx, emp in enumerate(assignment_employees):
            # Skip PA 1 - they are completely reserved for Priority Small only
            if emp['id'] == assignment_employees[0]['id']:
                continue

            max_assignable = working_hours
            # For PA 3, they can only be assigned regular tasks for the first half of their shift
            # The second half is already reserved for Prep
            if emp['id'] == 3:
                max_assignable = working_hours / 2  # Only first half available for regular tasks
                # But emp['hours'] already includes the Prep time, so we need to adjust
                prep_hours = working_hours / 2
                # Available hours for regular tasks = first half - (current hours - prep hours)
                emp_regular_hours = emp['hours'] - prep_hours if emp['hours'] >= prep_hours else emp['hours']
                available_hours = max_assignable - emp_regular_hours
            else:
                emp_hours = emp['hours']
                available_hours = max_assignable - emp_hours

            if emp['id'] != 3:  # For non-PA3, use the original calculation
                # Use integer math for task assignment
                max_tasks_for_emp = min(count, int(available_hours * rate_per_6_5h // 6.5))
            else:  # For PA 3, use the adjusted available_hours
                max_tasks_for_emp = min(count, int(available_hours * rate_per_6_5h // 6.5))

            if max_tasks_for_emp > 0:
                # Calculate hours_per_task for tracking
                tasks_per_shift = rate_per_6_5h * working_hours / 6.5
                hours_per_task = working_hours / tasks_per_shift if tasks_per_shift > 0 else 0
                emp['tasks'].extend({'name': task_name, 'hours': hours_per_task} for _ in range(max_tasks_for_emp))
                emp['hours'] += hours_per_task * max_tasks_for_emp
                count -= max_tasks_for_emp
                emp['case_counts'][task_name] = emp['case_counts'].get(task_name, 0) + max_tasks_for_emp

            if count == 0:
                break
        if count > 0:
            outstanding[task_name] += count
    
    # Filter out any remaining placeholder tasks from all employees (but keep "Available Time")
    for emp in employees:
        emp['tasks'] = [task for task in emp['tasks'] if task['name'] != 'Other Work']
    
    # Return case_counts in the employee dicts
    return [
        {k: v for k, v in emp.items() if k not in ('priority_small_dedicated',)}
        for emp in employees
    ], outstanding

def calculate_task_hours_and_overtime(original_tasks, available_people, working_hours, outstanding):
    # Use original task counts for accurate calculation, not modified ones
    total_tasks = sum(task['count'] for task in original_tasks)
    total_hours = 0
    overtime_by_type = {}
    
    # Calculate total hours based on original task counts
    for task in original_tasks:
        rate_per_6_5h = TASK_RATES.get(task['name'], 1)
        rate = rate_per_6_5h * (working_hours / 6.5)
        hours_per_task = 1 / rate * working_hours if rate > 0 else working_hours
        total_hours += task['count'] * hours_per_task
    
    estimated_days = math.ceil(total_hours / (available_people * working_hours)) if available_people and working_hours else 0
    total_outstanding = sum(outstanding.values())
    overtime = 0
    
    # Calculate overtime based on outstanding tasks
    for task in original_tasks:
        name = task['name']
        outstanding_count = outstanding.get(name, 0)
        if outstanding_count > 0:
            rate_per_6_5h = TASK_RATES.get(name, 1)
            rate = rate_per_6_5h * (working_hours / 6.5)
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
    if not isinstance(working_hours, (int, float)) or not (1 <= working_hours <= 24):
        return False, 'Working hours must be a number between 1 and 24.'
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
    working_hours = float(data.get('workingHours', 6.5))
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
    working_hours = float(data.get('workingHours', 6.5))
    valid, error = validate_inputs(tasks, available_people, working_hours)
    if not valid:
        return jsonify({'error': error}), 400
    employees, outstanding = distribute_tasks(tasks, available_people, working_hours)
    # Pass original tasks to summary calculation
    summary = calculate_task_hours_and_overtime(tasks, available_people, working_hours, outstanding)
    return jsonify(summary)

@app.route('/api/schedule_and_summary', methods=['POST'])
def api_schedule_and_summary():
    data = request.json
    tasks = data.get('tasks', [])
    available_people = int(data.get('availablePeople', 1))
    working_hours = float(data.get('workingHours', 6.5))
    valid, error = validate_inputs(tasks, available_people, working_hours)
    if not valid:
        return jsonify({'error': error}), 400
    employees, outstanding = distribute_tasks(tasks, available_people, working_hours)
    # Pass original tasks to summary calculation
    summary = calculate_task_hours_and_overtime(tasks, available_people, working_hours, outstanding)
    return jsonify({
        'employees': employees,
        'outstanding': outstanding,
        'summary': summary
    })

if __name__ == '__main__':
    print("Flask server started and print statements are working.")
    app.run(debug=True)
