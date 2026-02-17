document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const teacherRequiredMessage = document.getElementById(
    "teacher-required-message"
  );

  const userIconBtn = document.getElementById("user-icon-btn");
  const teacherMenu = document.getElementById("teacher-menu");
  const showLoginBtn = document.getElementById("show-login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const teacherStatus = document.getElementById("teacher-status");

  const loginModal = document.getElementById("login-modal");
  const teacherUsernameInput = document.getElementById("teacher-username");
  const teacherPasswordInput = document.getElementById("teacher-password");
  const loginSubmitBtn = document.getElementById("login-submit-btn");
  const loginCancelBtn = document.getElementById("login-cancel-btn");

  let teacherToken = localStorage.getItem("teacherToken") || "";
  let teacherUsername = localStorage.getItem("teacherUsername") || "";

  function isTeacherLoggedIn() {
    return teacherToken.length > 0;
  }

  function authHeaders() {
    return teacherToken ? { "X-Teacher-Token": teacherToken } : {};
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function clearTeacherSession() {
    teacherToken = "";
    teacherUsername = "";
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherUsername");
  }

  function updateAuthUI() {
    if (isTeacherLoggedIn()) {
      showLoginBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
      teacherStatus.textContent = `Teacher mode: ${teacherUsername}`;
      teacherRequiredMessage.classList.add("hidden");
      signupForm.classList.remove("hidden");
    } else {
      showLoginBtn.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
      teacherStatus.textContent = "Student mode";
      teacherRequiredMessage.classList.remove("hidden");
      signupForm.classList.add("hidden");
    }
  }

  function openLoginModal() {
    loginModal.classList.remove("hidden");
    teacherUsernameInput.focus();
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
    teacherPasswordInput.value = "";
  }

  async function handleTeacherLogin() {
    const username = teacherUsernameInput.value.trim();
    const password = teacherPasswordInput.value;

    if (!username || !password) {
      showMessage("Please enter username and password.", "error");
      return;
    }

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed.", "error");
        return;
      }

      teacherToken = result.token;
      teacherUsername = result.username;
      localStorage.setItem("teacherToken", teacherToken);
      localStorage.setItem("teacherUsername", teacherUsername);

      closeLoginModal();
      teacherMenu.classList.add("hidden");
      updateAuthUI();
      showMessage(result.message, "success");
      fetchActivities();
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  }

  async function handleTeacherLogout() {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          ...authHeaders(),
        },
      });
    } catch (error) {
      console.error("Error during logout:", error);
    }

    clearTeacherSession();
    updateAuthUI();
    teacherMenu.classList.add("hidden");
    showMessage("Logged out.", "info");
    fetchActivities();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      isTeacherLoggedIn()
                        ? `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                        : `<li><span class="participant-email">${email}</span></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacherLoggedIn()) {
      showMessage("Teacher login is required.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            ...authHeaders(),
          },
        }
      );

      const result = await response.json();

      if (response.status === 403) {
        clearTeacherSession();
        updateAuthUI();
        showMessage(result.detail || "Teacher login required.", "error");
        return;
      }

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isTeacherLoggedIn()) {
      showMessage("Teacher login is required.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            ...authHeaders(),
          },
        }
      );

      const result = await response.json();

      if (response.status === 403) {
        clearTeacherSession();
        updateAuthUI();
        showMessage(result.detail || "Teacher login required.", "error");
        return;
      }

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  userIconBtn.addEventListener("click", () => {
    teacherMenu.classList.toggle("hidden");
  });

  showLoginBtn.addEventListener("click", () => {
    openLoginModal();
  });

  logoutBtn.addEventListener("click", () => {
    handleTeacherLogout();
  });

  loginSubmitBtn.addEventListener("click", () => {
    handleTeacherLogin();
  });

  loginCancelBtn.addEventListener("click", () => {
    closeLoginModal();
  });

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModal();
    }
  });

  // Initialize app
  updateAuthUI();
  fetchActivities();
});
