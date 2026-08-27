import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { podService } from '../services/podService';
import { shipmentService } from '../services/shipmentService';
import { validatePODForm } from '../utils/podValidation';
import { PageHeader } from '../components/common/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { DocumentPreviewer } from '../components/document/DocumentPreviewer';
import { PackageMismatchBanner } from '../components/pod/PackageMismatchBanner';
import { Modal } from '../components/common/Modal';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Save,
  AlertTriangle,
  FileText,
  User,
  Phone,
  Calendar,
  Clock,
  Check,
  X
} from 'lucide-react';

const toISODate = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dateStr)) {
    const parts = dateStr.split(/[\/\-]/);
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return dateStr;
};

export const PODDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pod, setPod] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Rejection Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const fetchPODData = async () => {
    setLoading(true);
    try {
      const podData = await podService.getPOD(id);
      setPod(podData);
      setFormData({
        ...podData,
        deliveryDate: toISODate(podData.deliveryDate)
      });

      if (podData.shipmentId) {
        const sData = await shipmentService.getShipment(podData.shipmentId);
        setShipment(sData);
      }
    } catch (err) {
      alert(err.message || 'Failed to load POD profile.');
      navigate('/admin/pod');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPODData();
  }, [id]);

  const handleSaveDetailsOnly = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await podService.updatePODDetails(pod.id || pod.cnNumber, formData);
      setToastMessage('Delivery Date & POD Audit details updated successfully!');
    } catch (err) {
      alert(err.message || 'Failed to update POD details.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    if (e) e.preventDefault();
    const errs = validatePODForm(formData);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      await podService.verifyPOD(pod.id, formData);
      setToastMessage('POD successfully verified & approved! Shipment marked Delivered.');
      setTimeout(() => navigate('/admin/pod'), 1200);
    } catch (err) {
      alert(err.message || 'Failed to verify POD.');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert('Please specify a rejection reason.');
      return;
    }

    setSaving(true);
    try {
      await podService.rejectPOD(pod.id, rejectionReason);
      setToastMessage(`POD rejected: ${rejectionReason}`);
      setShowRejectModal(false);
      setTimeout(() => navigate('/admin/pod'), 1200);
    } catch (err) {
      alert(err.message || 'Failed to reject POD.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadPOD = async (file, base64Url) => {
    try {
      setSaving(true);
      const docUrl = base64Url || (file ? URL.createObjectURL(file) : '');
      const updatedPod = await podService.uploadPOD(pod.cnNumber || pod.shipmentId || id, {
        name: file?.name || 'POD_Scan.pdf',
        size: file?.size || 1024 * 1024,
        url: docUrl
      });

      // Update pod state directly without triggering loading unmount
      setPod((prev) => ({
        ...prev,
        ...updatedPod,
        url: docUrl,
        podDocumentUrl: docUrl,
        fileName: file?.name || prev?.fileName || 'POD_Scan.pdf',
        status: 'Uploaded'
      }));

      setToastMessage(`POD Document (${file?.name || 'Scan'}) uploaded successfully & saved to MongoDB!`);
    } catch (err) {
      alert('Failed to upload POD document: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading Proof of Delivery Audit Workspace..." />;
  }

  if (!pod) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title={`POD Review & Verification — ${pod.cnNumber}`}
        description="Verify receiver signatures, official stamps, and package count compliance."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'POD Management', pod.cnNumber]}
        actions={
          <button
            type="button"
            onClick={() => navigate('/admin/pod')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to POD List</span>
          </button>
        }
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="text-slate-400 hover:text-white font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SPLIT SCREEN REVIEW GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT PANE: DOCUMENT PREVIEW CANVAS */}
        <div className="h-full">
          <DocumentPreviewer
            fileName={pod.fileName || ''}
            fileType="pdf"
            initialUrl={pod.url || pod.podDocumentUrl || shipment?.podDocumentUrl || ''}
            onUpload={handleUploadPOD}
          />
        </div>

        {/* RIGHT PANE: EDITABLE POD VERIFICATION FORM */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Delivery Information & POD Audit</h3>
                <StatusBadge status={pod.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consignment Note: <strong className="font-mono text-setu-600">{pod.cnNumber}</strong> ({pod.companyName})
              </p>
            </div>

            {pod.status === 'Verified' && (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Verified ePOD
              </span>
            )}
          </div>

          {/* PACKAGE MISMATCH COMPLIANCE BANNER */}
          <PackageMismatchBanner
            shipmentPackages={pod.shipmentPackages}
            deliveredPackages={formData.deliveredPackages}
          />

          <form onSubmit={handleVerifySubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Receiver Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.receiverName || ''}
                  onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                  placeholder="e.g. Sanjay Deshmukh (Store Manager)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
                />
                {errors.receiverName && <span className="text-rose-600 text-[10px]">{errors.receiverName}</span>}
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Delivery Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.deliveryDate || ''}
                  onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
                />
                {errors.deliveryDate && <span className="text-rose-600 text-[10px]">{errors.deliveryDate}</span>}
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Delivery Time
                </label>
                <input
                  type="text"
                  value={formData.deliveryTime || ''}
                  onChange={(e) => setFormData({ ...formData, deliveryTime: e.target.value })}
                  placeholder="11:30 AM"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Shipment Packages
                </label>
                <input
                  type="number"
                  disabled
                  value={pod.shipmentPackages || 0}
                  className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Delivered Packages <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.deliveredPackages || 0}
                  onChange={(e) => setFormData({ ...formData, deliveredPackages: parseInt(e.target.value, 10) || 0 })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-setu-700"
                />
                {errors.deliveredPackages && <span className="text-rose-600 text-[10px]">{errors.deliveredPackages}</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Cargo Damage Status</label>
                <select
                  value={formData.damageStatus || 'No Damage'}
                  onChange={(e) => setFormData({ ...formData, damageStatus: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
                >
                  <option value="No Damage">No Damage</option>
                  <option value="Damaged">Damaged Box / Exception</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Shortage Status</label>
                <select
                  value={formData.shortageStatus || 'No Shortage'}
                  onChange={(e) => setFormData({ ...formData, shortageStatus: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
                >
                  <option value="No Shortage">No Shortage</option>
                  <option value="Shortage">Package Shortage</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={formData.signatureAvailable || false}
                  onChange={(e) => setFormData({ ...formData, signatureAvailable: e.target.checked })}
                  className="rounded text-setu-600 focus:ring-setu-600"
                />
                <span>Receiver Signature Verified</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={formData.stampAvailable || false}
                  onChange={(e) => setFormData({ ...formData, stampAvailable: e.target.checked })}
                  className="rounded text-setu-600 focus:ring-setu-600"
                />
                <span>Company Official Stamp Present</span>
              </label>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Delivery Remarks</label>
              <textarea
                rows={3}
                value={formData.remarks || ''}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Receiver notes, damage exception details..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-medium"
              />
            </div>

            {/* ACTION CONTROLS */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject POD</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDetailsOnly}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 text-slate-600" />
                  <span>{saving ? 'Saving...' : 'Save Date & Details'}</span>
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{saving ? 'Verifying...' : 'Confirm & Verify POD'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* REJECTION REASON MODAL */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Proof of Delivery (POD)"
        footer={
          <>
            <button
              onClick={() => setShowRejectModal(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectSubmit}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-sm"
            >
              Confirm Rejection
            </button>
          </>
        }
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs font-medium">
            Rejecting this POD will set POD status to <strong>Missing / Rejected</strong> and notify operations.
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
            >
              <option value="">Select Reason...</option>
              <option value="Receiver signature not visible">Receiver signature not visible</option>
              <option value="Official company stamp missing">Official company stamp missing</option>
              <option value="Package count mismatch on physical document">Package count mismatch on physical document</option>
              <option value="Document scan illegible or cut off">Document scan illegible or cut off</option>
              <option value="Wrong document uploaded">Wrong document uploaded</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};
