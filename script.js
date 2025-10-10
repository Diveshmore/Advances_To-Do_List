 const STORAGE_KEY = "todo_tasks_v2";
        const CREDITS_KEY = "todo_credits_v2";

        let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        let credits = Number(localStorage.getItem(CREDITS_KEY) || 0);
        let selectedCategory = "Work";
        const scheduled = new Map();
        let currentFilter = "all";
        let currentSearch = "";

        const taskInput = document.getElementById("taskInput");
        const deadlineInput = document.getElementById("deadlineInput");
        const priorityInput = document.getElementById("priorityInput");
        const addBtn = document.getElementById("addBtn");
        const pendingList = document.getElementById("pendingList");
        const completedList = document.getElementById("completedList");
        const searchInput = document.getElementById("searchInput");
        const filterButtons = document.querySelectorAll(".filter-btn");
        const creditsValueEl = document.getElementById("currentCredits");
        const tasksCompletedSummaryEl = document.getElementById("tasksCompletedSummary");
        const themeToggle = document.getElementById("themeToggle");
        const roadmapList = document.getElementById("roadmapList");
        const creditModal = document.getElementById("creditModal");
        const creditsBtn = document.querySelector(".credits-btn");
        const closeModalBtn = document.querySelector(".modal .close-button");
        const resetCreditsBtn = document.getElementById("resetCreditsBtn");
        const modalCurrentCredits = document.getElementById("modalCurrentCredits");
        const toastContainer = document.getElementById("toastContainer");
        const categoryChips = document.querySelectorAll(".category-chip");

        function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
        function saveCredits() { localStorage.setItem(CREDITS_KEY, String(credits)); }

        function formatDeadline(iso) {
            try {
                const d = new Date(iso);
                return d.toLocaleString(undefined, {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"});
            } catch(e) { return iso; }
        }

        function showToast(message, type = "info", ms = 4500) {
            const toastEl = document.createElement("div");
            toastEl.className = `toast ${type}`;
            toastEl.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
            toastContainer.appendChild(toastEl);
            setTimeout(() => toastEl.remove(), ms);
        }

        function notifyUser(title, body) {
            if ("Notification" in window && Notification.permission === "granted") {
                try { new Notification(title, {body}); return; } catch(e) {}
            }
            showToast(`${title} — ${body}`, "info", 6000);
        }

        const PRIORITY_WEIGHT = {
            "Low": 1, "Medium": 2, "High": 3, "Very High": 4, "First Priority": 5
        };

        function scheduleNotificationForTask(task) {
            if (task.completed || !task.deadline) return;
            const now = Date.now();
            const deadlineMs = new Date(task.deadline).getTime();
            const notifyAt = deadlineMs - 60000;
            const delay = notifyAt - now;

            if (scheduled.has(task.id)) {
                clearTimeout(scheduled.get(task.id));
                scheduled.delete(task.id);
            }

            if (delay > 0) {
                if ("Notification" in window && Notification.permission === "default") {
                    Notification.requestPermission().catch(() => {});
                }
                const to = setTimeout(() => {
                    notifyUser("⏰ Task Reminder", `"${task.text}" due at ${formatDeadline(task.deadline)}`);
                    scheduled.delete(task.id);
                }, delay);
                scheduled.set(task.id, to);
            }
        }

        function cancelScheduledNotification(taskId) {
            if (scheduled.has(taskId)) {
                clearTimeout(scheduled.get(taskId));
                scheduled.delete(taskId);
            }
        }

        function addSubtaskToTask(taskId, text) {
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;
            if (!task.subtasks) task.subtasks = [];
            const sub = { 
                id: `${Date.now()}_${Math.floor(Math.random()*10000)}`, 
                text, 
                completed: false, 
                createdAt: new Date().toISOString() 
            };
            task.subtasks.push(sub);
            saveTasks();
            renderTasks(currentFilter, currentSearch);
        }

        function toggleSubtask(taskId, subId, completed) {
            const task = tasks.find(t => t.id === taskId);
            if (!task || !task.subtasks) return;
            const s = task.subtasks.find(x => x.id === subId);
            if (!s) return;
            s.completed = completed;
            saveTasks();
            if (completed) {
                credits += 3;
                saveCredits();
                updateCreditsUI();
                showToast("Subtask completed! +3 Credits", "success", 2000);
            }
            renderTasks(currentFilter, currentSearch);
        }

        function deleteSubtask(taskId, subId) {
            const task = tasks.find(t => t.id === taskId);
            if (!task || !task.subtasks) return;
            task.subtasks = task.subtasks.filter(s => s.id !== subId);
            saveTasks();
            renderTasks(currentFilter, currentSearch);
            showToast("Subtask deleted", "info");
        }

        function getSortedPendingTasks() {
            const pending = tasks.filter(t => !t.completed);
            pending.sort((a, b) => {
                const pa = PRIORITY_WEIGHT[a.priority || "Low"] || 0;
                const pb = PRIORITY_WEIGHT[b.priority || "Low"] || 0;
                if (pa !== pb) return pb - pa;
                if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
                return 0;
            });
            return pending;
        }

        function createTaskDom(task) {
            const li = document.createElement("li");
            li.className = "task-item";
            li.setAttribute('data-id', task.id);

            const deadlineMs = task.deadline ? new Date(task.deadline).getTime() : null;
            const now = Date.now();
            const isOverdue = !task.completed && deadlineMs && (deadlineMs < now);

            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.className = "task-checkbox";
            chk.checked = !!task.completed;

            const content = document.createElement("div");
            content.className = "task-content";

            const title = document.createElement("div");
            title.className = "task-text";
            title.textContent = task.text;
            if (task.completed) title.style.textDecoration = "line-through";

            const meta = document.createElement("div");
            meta.className = "task-meta";

            const deadlineSpan = document.createElement("span");
            deadlineSpan.innerHTML = `<i class="far fa-calendar-alt"></i> ${formatDeadline(task.deadline)}`;

            const priorityBadge = document.createElement("span");
            priorityBadge.className = "badge badge-priority";
            priorityBadge.textContent = task.priority || "Low";

            const categoryPill = document.createElement("span");
            categoryPill.className = "badge badge-category";
            categoryPill.textContent = task.category || "General";

            if (isOverdue) {
                deadlineSpan.classList.add("badge", "badge-overdue");
                deadlineSpan.innerHTML = `<i class="fas fa-exclamation-triangle"></i> OVERDUE: ${formatDeadline(task.deadline)}`;
            } else if (deadlineMs && (deadlineMs - now) < 86400000) {
                deadlineSpan.classList.add("badge", "badge-today");
            }

            meta.appendChild(deadlineSpan);
            meta.appendChild(priorityBadge);
            meta.appendChild(categoryPill);

            content.appendChild(title);
            content.appendChild(meta);

            const actions = document.createElement("div");
            actions.className = "task-actions";

            const addSubBtn = document.createElement("button");
            addSubBtn.className = "action-btn add-sub-btn";
            addSubBtn.innerHTML = `<i class="fas fa-list-ul"></i>`;
            addSubBtn.title = "Add/View Subtasks";

            const editBtn = document.createElement("button");
            editBtn.className = "action-btn edit-btn";
            editBtn.innerHTML = `<i class="fas fa-edit"></i>`;
            editBtn.title = "Edit Task";

            const del = document.createElement("button");
            del.className = "action-btn delete-btn";
            del.innerHTML = `<i class="fas fa-trash-alt"></i>`;
            del.title = "Delete Task";

            actions.appendChild(addSubBtn);
            actions.appendChild(editBtn);
            actions.appendChild(del);

            li.appendChild(chk);
            li.appendChild(content);
            li.appendChild(actions);

            const subtasksContainer = document.createElement("div");
            subtasksContainer.className = "subtask-container";
            subtasksContainer.style.display = "none";

            if (task.subtasks && task.subtasks.length > 0) {
                const completedSubs = task.subtasks.filter(s => s.completed).length;
                const totalSubs = task.subtasks.length;
                const pct = totalSubs === 0 ? 0 : Math.round((completedSubs / totalSubs) * 100);

                const progressDiv = document.createElement("div");
                progressDiv.className = "subtask-progress";
                progressDiv.innerHTML = `<strong>Progress: ${completedSubs}/${totalSubs} (${pct}%)</strong>
                    <div class="progress-bar-wrapper">
                        <div class="progress-bar-fill" style="width: ${pct}%"></div>
                    </div>`;
                subtasksContainer.appendChild(progressDiv);

                const subList = document.createElement("ul");
                subList.className = "subtask-list";

                task.subtasks.forEach(s => {
                    const subLi = document.createElement("li");
                    subLi.className = "subtask-item";
                    subLi.setAttribute('data-sub-id', s.id);

                    const sc = document.createElement("input");
                    sc.type = "checkbox";
                    sc.className = "task-checkbox subtask-checkbox";
                    sc.checked = !!s.completed;

                    const st = document.createElement("span");
                    st.textContent = s.text;
                    st.style.flexGrow = "1";
                    if (s.completed) st.style.textDecoration = "line-through";

                    const delSubBtn = document.createElement("button");
                    delSubBtn.className = "action-btn delete-subtask-btn";
                    delSubBtn.innerHTML = `<i class="fas fa-times"></i>`;
                    delSubBtn.style.fontSize = "0.9rem";
                    delSubBtn.style.padding = "4px 8px";

                    subLi.appendChild(sc);
                    subLi.appendChild(st);
                    subLi.appendChild(delSubBtn);
                    subList.appendChild(subLi);
                });
                subtasksContainer.appendChild(subList);
            } else {
                const noSubs = document.createElement("p");
                noSubs.textContent = "No subtasks yet. Add one below!";
                noSubs.style.fontSize = "0.9em";
                noSubs.style.color = "var(--light-text)";
                subtasksContainer.appendChild(noSubs);
            }

            const addSubWrap = document.createElement("div");
            addSubWrap.className = "subtask-add-form";

            const subInput = document.createElement("input");
            subInput.type = "text";
            subInput.placeholder = "New subtask...";
            subInput.className = "subtask-text";

            const subAddBtn = document.createElement("button");
            subAddBtn.className = "add-subtask-btn";
            subAddBtn.innerHTML = '<i class="fas fa-plus"></i> Add';

            addSubWrap.appendChild(subInput);
            addSubWrap.appendChild(subAddBtn);
            subtasksContainer.appendChild(addSubWrap);

            li.appendChild(subtasksContainer);

            return li;
        }

        function renderTasks(filter = currentFilter, search = currentSearch) {
            currentFilter = filter;
            currentSearch = search || "";

            pendingList.innerHTML = "";
            completedList.innerHTML = "";

            let pendingCount = 0, completedCount = 0;
            const todayISO = new Date().toISOString().split("T")[0];

            const filtered = tasks.filter(task => {
                if (currentSearch && !task.text.toLowerCase().includes(currentSearch.toLowerCase())) return false;

                const deadlineMs = task.deadline ? new Date(task.deadline).getTime() : null;
                const now = Date.now();
                const isOverdue = !task.completed && deadlineMs && (deadlineMs < now);
                const dueDateISO = task.deadline ? new Date(task.deadline).toISOString().split("T")[0] : null;
                const isToday = !task.completed && dueDateISO === todayISO;

                if (!task.completed) pendingCount++;
                if (task.completed) completedCount++;

                if (filter === "pending" && task.completed) return false;
                if (filter === "completed" && !task.completed) return false;
                if (filter === "overdue" && !isOverdue) return false;
                if (filter === "today" && !isToday) return false;
                if (filter === "week") {
                    const weekFromNow = new Date(now + 7 * 24 * 60 * 60 * 1000);
                    if (task.completed || !deadlineMs || deadlineMs > weekFromNow.getTime()) return false;
                }

                return true;
            });

            if (filtered.length === 0) {
                const emptyMsg = document.createElement("div");
                emptyMsg.className = "empty-state";
                emptyMsg.innerHTML = `
                    <i class="fas fa-inbox"></i>
                    <p>No tasks found</p>
                `;
                if (!currentSearch && filter === "all") {
                    emptyMsg.innerHTML = `
                        <i class="fas fa-check-circle"></i>
                        <p>You're all caught up! 🎉</p>
                    `;
                }
                pendingList.appendChild(emptyMsg);
            } else {
                filtered.forEach(task => {
                    const li = createTaskDom(task);
                    if (task.completed) completedList.appendChild(li);
                    else pendingList.appendChild(li);
                });
            }

            updateDashboardUI({ total: tasks.length, pending: pendingCount, completed: completedCount });
            updateFilterActiveState(filter);
            updateRoadmapUI();
        }

        function updateRoadmapUI() {
            const sortedTasks = getSortedPendingTasks();

            if (sortedTasks.length === 0) {
                roadmapList.innerHTML = `<p style="color: var(--light-text); padding: 10px; text-align: center;">All clear! No pending tasks. 🎉</p>`;
                return;
            }

            roadmapList.innerHTML = '';

            sortedTasks.slice(0, 5).forEach((task, index) => {
                const priorityClass = `priority-${(task.priority || 'Low').replace(/\s/g, '-')}`;
                const shortText = task.text.length > 40 ? task.text.slice(0, 37) + "..." : task.text;

                const item = document.createElement('div');
                item.className = `roadmap-item ${priorityClass}`;
                item.setAttribute('data-id', task.id);

                item.innerHTML = `
                    <div class="roadmap-title">#${index + 1}: ${shortText}</div>
                    <div class="roadmap-meta">
                        ${task.priority} Priority | Due: ${formatDeadline(task.deadline)}
                    </div>
                `;

                roadmapList.appendChild(item);
            });
        }

        function updateDashboardUI(counts) {
            document.getElementById("totalTasks").textContent = counts.total;
            document.getElementById("pendingTasks").textContent = counts.pending;
            document.getElementById("completedTasks").textContent = counts.completed;
            tasksCompletedSummaryEl.textContent = counts.completed;
            updateCreditsUI();
        }

        function updateCreditsUI() {
            creditsValueEl.textContent = credits;
            if (modalCurrentCredits) modalCurrentCredits.textContent = credits;
        }

        function updateFilterActiveState(filter) {
            filterButtons.forEach(b => b.classList.toggle("active", b.dataset.filter === filter));
        }

        categoryChips.forEach(chip => {
            chip.addEventListener("click", () => {
                categoryChips.forEach(c => c.classList.remove("active"));
                chip.classList.add("active");
                selectedCategory = chip.dataset.category;
            });
        });

        addBtn.addEventListener("click", () => {
            const text = taskInput.value.trim();
            const deadline = deadlineInput.value;
            const priority = priorityInput.value;

            if (!text || !deadline) {
                showToast("Please enter a task and deadline", "error");
                taskInput.focus();
                return;
            }

            const id = `${Date.now()}_${Math.floor(Math.random()*10000)}`;
            const newTask = {
                id, text, deadline,
                category: selectedCategory,
                priority,
                subtasks: [],
                completed: false,
                createdAt: new Date().toISOString()
            };
            tasks.push(newTask);
            saveTasks();
            scheduleNotificationForTask(newTask);
            renderTasks("all", "");
            showToast("Task added successfully!", "success");

            taskInput.value = "";
            deadlineInput.value = "";
            priorityInput.value = "Medium";
        });

        taskInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") addBtn.click();
        });

        searchInput.addEventListener("input", e => {
            renderTasks(currentFilter, e.target.value.trim());
        });

        filterButtons.forEach(btn => btn.addEventListener("click", () => {
            renderTasks(btn.dataset.filter, searchInput.value.trim());
        }));

        function handleTaskEvents(e) {
            const li = e.target.closest('.task-item');
            if (!li) return;

            const taskId = li.dataset.id;
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            if (e.target.matches('.task-checkbox:not(.subtask-checkbox)')) {
                task.completed = e.target.checked;
                if (task.completed) {
                    cancelScheduledNotification(task.id);
                    credits += 10;
                    saveCredits();
                    showToast("Task Completed! +10 Credits 🎉", "success");
                } else {
                    scheduleNotificationForTask(task);
                }
                saveTasks();
                updateCreditsUI();
                renderTasks(currentFilter, currentSearch);
                return;
            }

            if (e.target.closest('.delete-btn')) {
                if (confirm(`Delete "${task.text}"?`)) {
                    cancelScheduledNotification(task.id);
                    tasks = tasks.filter(t => t.id !== task.id);
                    saveTasks();
                    renderTasks(currentFilter, currentSearch);
                    showToast("Task deleted", "info");
                }
                return;
            }

            if (e.target.closest('.edit-btn')) {
                const newText = prompt("Edit task:", task.text);
                if (newText && newText.trim()) {
                    task.text = newText.trim();
                    saveTasks();
                    renderTasks(currentFilter, currentSearch);
                    showToast("Task updated", "success");
                }
                return;
            }

            if (e.target.closest('.add-sub-btn')) {
                const subContainer = li.querySelector('.subtask-container');
                if (subContainer) {
                    subContainer.style.display = subContainer.style.display === "none" ? "block" : "none";
                    if (subContainer.style.display === "block") {
                        const subInput = li.querySelector('.subtask-text');
                        if (subInput) subInput.focus();
                    }
                }
                return;
            }

            if (e.target.matches('.subtask-checkbox')) {
                const subLi = e.target.closest('.subtask-item');
                if (!subLi) return;
                const subId = subLi.dataset.subId;
                toggleSubtask(taskId, subId, e.target.checked);
                return;
            }

            if (e.target.closest('.delete-subtask-btn')) {
                const subLi = e.target.closest('.subtask-item');
                if (!subLi) return;
                const subId = subLi.dataset.subId;
                if (confirm("Delete this subtask?")) {
                    deleteSubtask(taskId, subId);
                }
                return;
            }

            if (e.target.matches('.add-subtask-btn') || e.target.closest('.add-subtask-btn')) {
                const subInput = li.querySelector('.subtask-text');
                if (!subInput) return;

                const v = subInput.value.trim();
                if (!v) {
                    showToast("Subtask cannot be empty", "error", 2000);
                    return;
                }
                addSubtaskToTask(taskId, v);
                subInput.value = "";
                showToast("Subtask added!", "success", 2000);
                return;
            }
        }

        pendingList.addEventListener('click', handleTaskEvents);
        completedList.addEventListener('click', handleTaskEvents);

        themeToggle.addEventListener("click", () => {
            document.body.classList.toggle("dark");
            const isDark = document.body.classList.contains("dark");
            themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            localStorage.setItem("theme", isDark ? "dark" : "light");
        });

        creditsBtn.addEventListener('click', () => {
            updateCreditsUI();
            creditModal.style.display = "flex";
        });

        closeModalBtn.addEventListener('click', () => {
            creditModal.style.display = "none";
        });

        window.addEventListener('click', (event) => {
            if (event.target === creditModal) {
                creditModal.style.display = "none";
            }
        });

        resetCreditsBtn.addEventListener('click', () => {
            if (confirm("Reset credits to 0?")) {
                credits = 0;
                saveCredits();
                updateCreditsUI();
                showToast("Credits reset", "info");
                creditModal.style.display = "none";
            }
        });

        function init() {
            tasks.forEach(task => scheduleNotificationForTask(task));
            updateCreditsUI();
            renderTasks("all", "");

            const savedTheme = localStorage.getItem("theme");
            if (savedTheme === "dark") {
                document.body.classList.add("dark");
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            }

            if ("Notification" in window && Notification.permission === "default") {
                Notification.requestPermission().catch(() => {});
            }
        }

        if (!localStorage.getItem(CREDITS_KEY)) saveCredits();
        init();