// ============================================================
//  Admin.jsx  —  Admin Panel Component
//  Add and delete users.
//  Styles come from: global.css + Admin.css
// ============================================================

import { useState } from "react";
import "../styles/Admin.css";                           // Admin-specific styles
import { addUser, deleteUser, getAllUsers } from "../index.js";

function Admin() {
  const [newName,  setNewName]  = useState("");
  const [userList, setUserList] = useState(getAllUsers());
  const [message,  setMessage]  = useState(null); // { text, isError }

  // ── Add user ──
  function handleAdd() {
    if (!newName.trim()) {
      setMessage({ text: "Please enter a name.", isError: true });
      return;
    }
    const created = addUser(newName);
    setNewName("");
    setUserList(getAllUsers());
    setMessage({ text: 'User "' + created.name + '" (' + created.id + ') added successfully.', isError: false });
  }

  // ── Delete user ──
  function handleDelete(uid) {
    deleteUser(uid);
    setUserList(getAllUsers());
    setMessage({ text: "User " + uid + " has been deleted.", isError: false });
  }

  return (
    <div className="page">
      <h2 className="page-title">Admin Panel</h2>
      <p className="page-subtitle">Add or remove users from the platform</p>

      {/* ── Add User Card ── */}
      <div className="card">
        <div className="card-title">Add New User</div>

        <div className="admin-add-row">
          <input
            className="input"
            type="text"
            placeholder="Enter full name..."
            value={newName}
            onChange={function (e) { setNewName(e.target.value); }}
            onKeyDown={function (e) { if (e.key === "Enter") handleAdd(); }}
          />
          <button className="btn btn-accent" onClick={handleAdd}>
            + Add User
          </button>
        </div>

        {/* Success / error message */}
        {message && (
          <div className={"alert " + (message.isError ? "alert-error" : "alert-success")}>
            {message.text}
          </div>
        )}
      </div>

      {/* ── Users List Card ── */}
      <div className="card">
        <div className="card-title">
          All Users
          <span className="admin-user-count">{userList.length}</span>
        </div>

        {userList.length === 0 ? (
          <p className="empty-state">No users yet. Add one above.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th className="admin-action-cell">Action</th>
              </tr>
            </thead>
            <tbody>
              {userList.map(function (user) {
                return (
                  <tr key={user.id}>
                    <td className="admin-user-id">{user.id}</td>
                    <td className="admin-user-name">{user.name}</td>
                    <td>
                      <button
                        className="btn btn-outline-red"
                        onClick={function () { handleDelete(user.id); }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Admin;