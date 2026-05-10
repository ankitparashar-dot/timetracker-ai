from flask import Blueprint, request, jsonify
from auth import load_db, save_db, get_current_user
from datetime import datetime
import uuid, os, base64

routes_bp = Blueprint('routes', __name__)

SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), 'screenshots')
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# ─── PROJECTS ───────────────────────────────────────────────

@routes_bp.route('/projects', methods=['GET'])
def get_projects():
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401

    db = load_db()

    if current['role'] == 'admin':
        projects = [p for p in db['projects'] if p['owner_id'] == current['id']]
    else:
        member_project_ids = [
            m['project_id'] for m in db['members']
            if m['user_id'] == current['id']
        ]
        projects = [p for p in db['projects'] if p['id'] in member_project_ids]

    result = []
    for p in projects:
        members = [m for m in db['members'] if m['project_id'] == p['id']]
        tasks = [t for t in db['tasks'] if t['project_id'] == p['id']]
        owner = next((u for u in db['users'] if u['id'] == p['owner_id']), None)
        result.append({
            **p,
            "member_count": len(members),
            "task_count": len(tasks),
            "owner_name": owner['name'] if owner else "Unknown"
        })

    return jsonify(result), 200


@routes_bp.route('/projects', methods=['POST'])
def create_project():
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401
    if current['role'] != 'admin':
        return jsonify({"error": "Only admins can create projects"}), 403

    data = request.get_json()
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()

    if not name:
        return jsonify({"error": "Project name is required"}), 400

    db = load_db()
    project = {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": description,
        "owner_id": current['id'],
        "status": "active",
        "created_at": datetime.utcnow().isoformat()
    }
    db['projects'].append(project)

    db['members'].append({
        "id": str(uuid.uuid4()),
        "project_id": project['id'],
        "user_id": current['id'],
        "role": "admin"
    })
    save_db(db)
    return jsonify(project), 201


@routes_bp.route('/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    current = get_current_user()
    if not current or current['role'] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    db = load_db()
    project = next((p for p in db['projects'] if p['id'] == project_id), None)
    if not project or project['owner_id'] != current['id']:
        return jsonify({"error": "Project not found or not authorized"}), 404

    db['projects'] = [p for p in db['projects'] if p['id'] != project_id]
    db['tasks'] = [t for t in db['tasks'] if t['project_id'] != project_id]
    db['members'] = [m for m in db['members'] if m['project_id'] != project_id]
    save_db(db)
    return jsonify({"message": "Project deleted"}), 200


# ─── MEMBERS ────────────────────────────────────────────────

@routes_bp.route('/projects/<project_id>/members', methods=['GET'])
def get_members(project_id):
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401

    db = load_db()
    members = [m for m in db['members'] if m['project_id'] == project_id]
    result = []
    for m in members:
        user = next((u for u in db['users'] if u['id'] == m['user_id']), None)
        if user:
            result.append({
                "id": m['id'],
                "user_id": user['id'],
                "name": user['name'],
                "email": user['email'],
                "role": m['role'],
                "is_current_user": user['id'] == current['id']
            })
    return jsonify(result), 200


@routes_bp.route('/projects/<project_id>/members', methods=['POST'])
def add_member(project_id):
    current = get_current_user()
    if not current or current['role'] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    email = data.get('email', '').strip().lower()

    db = load_db()

    project = next((p for p in db['projects'] if p['id'] == project_id), None)
    if not project or project['owner_id'] != current['id']:
        return jsonify({"error": "Project not found"}), 404

    user = next((u for u in db['users'] if u['email'] == email), None)
    if not user:
        return jsonify({"error": "No user found with that email. They must register first."}), 404

    already = any(
        m['project_id'] == project_id and m['user_id'] == user['id']
        for m in db['members']
    )
    if already:
        return jsonify({"error": "User is already a member of this project"}), 409

    member = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "user_id": user['id'],
        "role": "member"
    }
    db['members'].append(member)
    save_db(db)
    return jsonify({
        "message": "Member added successfully",
        "user": {"name": user['name'], "email": user['email']}
    }), 201


@routes_bp.route('/projects/<project_id>/members/<member_id>', methods=['DELETE'])
def remove_member(project_id, member_id):
    current = get_current_user()
    if not current or current['role'] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    db = load_db()
    db['members'] = [
        m for m in db['members']
        if not (m['project_id'] == project_id and m['id'] == member_id)
    ]
    save_db(db)
    return jsonify({"message": "Member removed"}), 200


# ─── TASKS ──────────────────────────────────────────────────

@routes_bp.route('/projects/<project_id>/tasks', methods=['GET'])
def get_tasks(project_id):
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401

    db = load_db()

    is_member = any(
        m['project_id'] == project_id and m['user_id'] == current['id']
        for m in db['members']
    )
    is_owner = any(
        p['id'] == project_id and p['owner_id'] == current['id']
        for p in db['projects']
    )
    if not is_member and not is_owner:
        return jsonify({"error": "Access denied"}), 403

    tasks = [t for t in db['tasks'] if t['project_id'] == project_id]
    result = []
    for t in tasks:
        assignee = next((u for u in db['users'] if u['id'] == t.get('assignee_id')), None)
        result.append({
            **t,
            "assignee_name": assignee['name'] if assignee else "Unassigned",
            "is_mine": t.get('assignee_id') == current['id']
        })
    return jsonify(result), 200


@routes_bp.route('/projects/<project_id>/tasks', methods=['POST'])
def create_task(project_id):
    current = get_current_user()
    if not current or current['role'] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    assignee_id = data.get('assignee_id') or None
    due_date = data.get('due_date') or None
    priority = data.get('priority', 'medium')

    if not title:
        return jsonify({"error": "Task title is required"}), 400

    if assignee_id:
        db = load_db()
        is_valid_assignee = any(
            m['project_id'] == project_id and m['user_id'] == assignee_id
            for m in db['members']
        )
        if not is_valid_assignee:
            return jsonify({"error": "Assignee must be a project member"}), 400
    else:
        db = load_db()

    task = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "title": title,
        "description": description,
        "assignee_id": assignee_id,
        "due_date": due_date,
        "priority": priority,
        "status": "todo",
        "created_at": datetime.utcnow().isoformat()
    }
    db['tasks'].append(task)
    save_db(db)

    assignee = next((u for u in db['users'] if u['id'] == assignee_id), None)
    return jsonify({
        **task,
        "assignee_name": assignee['name'] if assignee else "Unassigned",
        "is_mine": assignee_id == current['id']
    }), 201


@routes_bp.route('/projects/<project_id>/tasks/<task_id>', methods=['PATCH'])
def update_task(project_id, task_id):
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401

    db = load_db()
    task = next(
        (t for t in db['tasks'] if t['id'] == task_id and t['project_id'] == project_id),
        None
    )
    if not task:
        return jsonify({"error": "Task not found"}), 404

    data = request.get_json()

    if current['role'] == 'member':
        if task.get('assignee_id') != current['id']:
            return jsonify({"error": "You can only update tasks assigned to you"}), 403
        if 'status' in data:
            task['status'] = data['status']
    else:
        for field in ['title', 'description', 'assignee_id', 'due_date', 'priority', 'status']:
            if field in data:
                task[field] = data[field]

    save_db(db)

    assignee = next((u for u in db['users'] if u['id'] == task.get('assignee_id')), None)
    return jsonify({
        **task,
        "assignee_name": assignee['name'] if assignee else "Unassigned",
        "is_mine": task.get('assignee_id') == current['id']
    }), 200


@routes_bp.route('/projects/<project_id>/tasks/<task_id>', methods=['DELETE'])
def delete_task(project_id, task_id):
    current = get_current_user()
    if not current or current['role'] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    db = load_db()
    db['tasks'] = [
        t for t in db['tasks']
        if not (t['id'] == task_id and t['project_id'] == project_id)
    ]
    save_db(db)
    return jsonify({"message": "Task deleted"}), 200


# ─── DASHBOARD ──────────────────────────────────────────────

@routes_bp.route('/dashboard', methods=['GET'])
def dashboard():
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401

    db = load_db()

    if current['role'] == 'admin':
        my_projects = [p for p in db['projects'] if p['owner_id'] == current['id']]
        project_ids = [p['id'] for p in my_projects]
    else:
        member_project_ids = [
            m['project_id'] for m in db['members']
            if m['user_id'] == current['id']
        ]
        my_projects = [p for p in db['projects'] if p['id'] in member_project_ids]
        project_ids = member_project_ids

    all_tasks = [t for t in db['tasks'] if t['project_id'] in project_ids]
    my_tasks = [t for t in all_tasks if t.get('assignee_id') == current['id']]

    today = datetime.utcnow().date().isoformat()
    overdue = [
        t for t in all_tasks
        if t.get('due_date') and t['due_date'] < today and t['status'] != 'done'
    ]

    return jsonify({
        "total_projects": len(my_projects),
        "total_tasks": len(all_tasks),
        "my_tasks": len(my_tasks),
        "overdue_tasks": len(overdue),
        "todo": len([t for t in all_tasks if t['status'] == 'todo']),
        "in_progress": len([t for t in all_tasks if t['status'] == 'in_progress']),
        "done": len([t for t in all_tasks if t['status'] == 'done']),
        "recent_tasks": sorted(all_tasks, key=lambda x: x['created_at'], reverse=True)[:5]
    }), 200


# ─── ALL USERS ───────────────────────────────────────────────

@routes_bp.route('/users', methods=['GET'])
def get_users():
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401
    db = load_db()
    return jsonify([
        {"id": u['id'], "name": u['name'], "email": u['email'], "role": u['role']}
        for u in db['users']
    ]), 200


# ─── TIMER ──────────────────────────────────────────────────

@routes_bp.route('/tasks/<task_id>/timer', methods=['GET'])
def get_timer(task_id):
    """Return persisted timer state for a task (user-scoped)."""
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401

    db = load_db()
    timers = db.get('timers', {})
    key = f"{current['id']}_{task_id}"
    state = timers.get(key, {"elapsed": 0, "running": False, "startedAt": None})
    return jsonify(state), 200


@routes_bp.route('/tasks/<task_id>/timer', methods=['POST'])
def save_timer(task_id):
    """Persist timer state for a task (user-scoped)."""
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    elapsed = data.get('elapsed', 0)
    running = data.get('running', False)
    started_at = data.get('startedAt', None)

    db = load_db()
    if 'timers' not in db:
        db['timers'] = {}

    key = f"{current['id']}_{task_id}"
    db['timers'][key] = {
        "elapsed": elapsed,
        "running": running,
        "startedAt": started_at,
        "updatedAt": datetime.utcnow().isoformat()
    }
    save_db(db)
    return jsonify({"message": "Timer saved"}), 200


@routes_bp.route('/tasks/<task_id>/timer/reset', methods=['POST'])
def reset_timer(task_id):
    """Reset timer for a task (user-scoped)."""
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401

    db = load_db()
    if 'timers' not in db:
        db['timers'] = {}

    key = f"{current['id']}_{task_id}"
    db['timers'][key] = {"elapsed": 0, "running": False, "startedAt": None}
    save_db(db)
    return jsonify({"message": "Timer reset"}), 200


# ─── SCREENSHOTS ─────────────────────────────────────────────

@routes_bp.route('/tasks/<task_id>/screenshots', methods=['POST'])
def save_screenshot(task_id):
    """Save a base64 screenshot tied to a task and user."""
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    image_data = data.get('image')  # base64 PNG data URL
    if not image_data:
        return jsonify({"error": "No image data"}), 400

    # Strip data URL prefix if present
    if ',' in image_data:
        image_data = image_data.split(',', 1)[1]

    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    filename = f"{current['id']}_{task_id}_{timestamp}.png"
    filepath = os.path.join(SCREENSHOTS_DIR, filename)

    with open(filepath, 'wb') as f:
        f.write(base64.b64decode(image_data))

    # Track in db
    db = load_db()
    if 'screenshots' not in db:
        db['screenshots'] = []
    db['screenshots'].append({
        "id": str(uuid.uuid4()),
        "user_id": current['id'],
        "task_id": task_id,
        "filename": filename,
        "captured_at": datetime.utcnow().isoformat()
    })
    save_db(db)

    return jsonify({"message": "Screenshot saved", "filename": filename}), 201


@routes_bp.route('/tasks/<task_id>/screenshots', methods=['GET'])
def list_screenshots(task_id):
    """List screenshots for a task (admin sees all, member sees own)."""
    current = get_current_user()
    if not current:
        return jsonify({"error": "Unauthorized"}), 401

    db = load_db()
    screenshots = db.get('screenshots', [])

    if current['role'] == 'admin':
        result = [s for s in screenshots if s['task_id'] == task_id]
    else:
        result = [s for s in screenshots if s['task_id'] == task_id and s['user_id'] == current['id']]

    return jsonify(result), 200