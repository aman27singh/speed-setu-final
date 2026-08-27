import React, { useState, useEffect } from 'react';
import { userService } from '../services/userService';
import { PageHeader } from '../components/common/PageHeader';
import { KPICard } from '../components/common/KPICard';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  Users,
  UserPlus,
  Shield,
  Building2,
  Key,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Lock,
  Mail,
  User,
  Phone,
  Database,
  RefreshCw,
  X
} from 'lucide-react';

export const SettingsPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'Super Admin',
    branch: 'Headquarters',
    status: 'Active',
    phone: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation State
  const [deletingUser, setDeletingUser] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message || 'Failed to load users list from MongoDB Atlas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      username: '',
      email: '',
      password: '',
      role: 'Operations Manager',
      branch: 'Headquarters',
      status: 'Active',
      phone: ''
    });
    setFormError('');
    setShowUserModal(true);
  };

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      password: '', // leave empty unless changing
      role: user.role || 'Admin',
      branch: user.branch || 'Headquarters',
      status: user.status || 'Active',
      phone: user.phone || ''
    });
    setFormError('');
    setShowUserModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim() || !formData.username.trim() || !formData.email.trim()) {
      setFormError('Full Name, Username, and Email are required.');
      return;
    }

    if (!editingUser && !formData.password.trim()) {
      setFormError('Password is required for new user creation.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        // Update user
        const updatePayload = { ...formData };
        if (!updatePayload.password) delete updatePayload.password;
        await userService.updateUser(editingUser.id || editingUser._id, updatePayload);
      } else {
        // Create user
        await userService.createUser(formData);
      }
      setShowUserModal(false);
      fetchUsers();
    } catch (err) {
      setFormError(err.message || 'Failed to save user account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      await userService.deleteUser(deletingUser.id || deletingUser._id);
      setDeletingUser(null);
      fetchUsers();
    } catch (err) {
      alert(`Failed to delete user: ${err.message}`);
    }
  };

  if (loading) return <LoadingState message="Loading ERP System Settings & User Matrix..." />;
  if (error) return <ErrorState message={error} onRetry={fetchUsers} />;

  const activeUsersCount = users.filter((u) => u.status === 'Active').length;
  const superAdminCount = users.filter((u) => u.role === 'Super Admin').length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title="ERP Settings & Administration"
        description="Manage system access, user accounts, role permissions, and branch configurations live on MongoDB Atlas."
        breadcrumbs={['Speed Setu Admin', 'System Settings']}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Users</span>
            </button>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New User Account</span>
            </button>
          </div>
        }
      />

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total System Users" value={users.length} subtext="Registered ERP user accounts" icon={Users} variant="accent" />
        <KPICard title="Active Accounts" value={activeUsersCount} subtext="Currently authorized users" icon={CheckCircle2} variant="default" />
        <KPICard title="Super Administrators" value={superAdminCount} subtext="Full administrative access" icon={Shield} variant="warning" />
      </div>

      {/* User Management Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-setu-600" />
              <span>User Accounts & Role Permissions Matrix</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">All credentials and role assignments are synchronized live with MongoDB Atlas.</p>
          </div>
          <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-2xs self-start sm:self-auto">
            {users.length} Total Users
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {users.map((u) => (
                <tr key={u.id || u._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-setu-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                    @{u.username}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      u.role === 'Super Admin'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : u.role === 'Operations Manager'
                        ? 'bg-blue-50 text-setu-700 border border-blue-200'
                        : u.role === 'Billing Admin'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      <Shield className="w-3 h-3" />
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-700">
                    {u.branch || 'Headquarters'}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={u.status || 'Active'} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(u)}
                        className="p-1.5 text-slate-600 hover:text-setu-600 hover:bg-slate-100 rounded transition-colors"
                        title="Edit User"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingUser(u)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {showUserModal && (
        <Modal
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
          title={editingUser ? `Edit User: ${editingUser.name}` : 'Add New User Account'}
        >
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-setu-600/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. rahul_ops"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-setu-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="rahul@speedsetu.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-setu-600/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password {editingUser ? '(Leave empty to keep unchanged)' : <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? '••••••••' : 'Enter account password'}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-setu-600/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Role Assignment <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-setu-600/20"
                >
                  <option value="Super Admin">Super Admin (Full Control)</option>
                  <option value="Operations Manager">Operations Manager (Shipments & Trips)</option>
                  <option value="Billing Admin">Billing Admin (Invoices & Rates)</option>
                  <option value="Accounts Executive">Accounts Executive (Payments & Payables)</option>
                  <option value="Fleet Manager">Fleet Manager (Vehicles & Drivers)</option>
                  <option value="Branch Manager">Branch Manager (Regional Ops)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Branch Location
                </label>
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-setu-600/20"
                >
                  <option value="Headquarters">Headquarters (Bengaluru)</option>
                  <option value="Delhi Hub">Delhi NCR Regional Hub</option>
                  <option value="Mumbai Hub">Mumbai Commercial Hub</option>
                  <option value="Chennai Hub">Chennai Southern Logistics Terminal</option>
                  <option value="Kolkata Hub">Kolkata Eastern Hub</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-setu-600/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Account Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-setu-600/20"
                >
                  <option value="Active">Active (Permit Access)</option>
                  <option value="Inactive">Inactive (Block Access)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 disabled:opacity-50 rounded-lg transition-colors shadow-sm"
              >
                {submitting ? 'Saving User...' : editingUser ? 'Update User Account' : 'Create User Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <Modal
          isOpen={Boolean(deletingUser)}
          onClose={() => setDeletingUser(null)}
          title="Confirm User Deletion"
        >
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-bold">Are you sure you want to delete this user?</p>
                <p className="mt-0.5">User <strong>{deletingUser.name}</strong> (@{deletingUser.username}) will be permanently deleted from MongoDB Atlas.</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
              >
                Delete Account
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
