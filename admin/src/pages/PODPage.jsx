import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { podService } from '../services/podService';
import { companyService } from '../services/companyService';
import { formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { KPICard } from '../components/common/KPICard';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { FilterBar } from '../components/common/FilterBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { PODUploadModal } from '../components/pod/PODUploadModal';
import {
  FileCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Eye,
  ArrowRight,
  XCircle,
  FileText
} from 'lucide-react';

export const PODPage = () => {
  const navigate = useNavigate();
  const [pods, setPods] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [companyFilter, setCompanyFilter] = useState('All');

  // Quick upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [targetShipmentId, setTargetShipmentId] = useState('');
  const [targetCN, setTargetCN] = useState('');

  // Multi-selection & Toast state
  const [selectedCNs, setSelectedCNs] = useState([]);
  const [verifyingBulk, setVerifyingBulk] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchPODData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pData, cData] = await Promise.all([
        podService.getPODs({ search, status: statusFilter, companyId: companyFilter }),
        companyService.getCompanies()
      ]);
      setPods(pData);
      setCompanies(cData);
    } catch (err) {
      setError(err.message || 'Failed to load POD records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPODData();
  }, [search, statusFilter, companyFilter]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allCNs = pods.map((p) => p.cnNumber || p.id).filter(Boolean);
      setSelectedCNs(allCNs);
    } else {
      setSelectedCNs([]);
    }
  };

  const handleSelectRow = (cnKey, e) => {
    if (e) e.stopPropagation();
    if (selectedCNs.includes(cnKey)) {
      setSelectedCNs(selectedCNs.filter((c) => c !== cnKey));
    } else {
      setSelectedCNs([...selectedCNs, cnKey]);
    }
  };

  const handleBulkVerify = async () => {
    const count = selectedCNs.length;
    if (count === 0) return;

    if (
      window.confirm(
        `Are you sure you want to mark ${count} selected POD${count > 1 ? 's' : ''} as VERIFIED & DELIVERED?`
      )
    ) {
      setVerifyingBulk(true);
      try {
        await podService.bulkVerifyPODs(selectedCNs);
        setToastMessage(`Successfully verified and marked ${count} shipment${count > 1 ? 's' : ''} as Delivered!`);
        setSelectedCNs([]);
        fetchPODData();
        setTimeout(() => setToastMessage(''), 4000);
      } catch (err) {
        alert(`Bulk verification error: ${err.message}`);
      } finally {
        setVerifyingBulk(false);
      }
    }
  };

  const statusOptions = [
    { label: 'All PODs', value: 'All' },
    { label: 'Pending', value: 'Pending' },
    { label: 'Uploaded', value: 'Uploaded' },
    { label: 'Needs Review', value: 'Needs Review' },
    { label: 'Verified', value: 'Verified' },
    { label: 'Missing', value: 'Missing' },
    { label: 'Rejected', value: 'Rejected' }
  ];

  const columns = [
    {
      header: (
        <input
          type="checkbox"
          checked={pods.length > 0 && selectedCNs.length === pods.length}
          onChange={handleSelectAll}
          className="w-4 h-4 rounded text-setu-600 focus:ring-setu-500 cursor-pointer accent-setu-600"
          title="Select All POD Records"
        />
      ),
      key: 'select',
      align: 'center',
      render: (row) => {
        const cnKey = row.cnNumber || row.id;
        const isSelected = selectedCNs.includes(cnKey);
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => handleSelectRow(cnKey, e)}
              className="w-4 h-4 rounded text-setu-600 focus:ring-setu-500 cursor-pointer accent-setu-600"
            />
          </div>
        );
      }
    },
    {
      header: 'CN Number',
      accessor: 'cnNumber',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/pod/${row.cnNumber}`)}
          className="font-bold text-setu-600 font-mono hover:underline cursor-pointer"
        >
          {row.cnNumber}
        </span>
      )
    },
    {
      header: 'Company',
      accessor: 'companyName',
      render: (row) => <span className="font-bold text-slate-900 text-xs">{row.companyName}</span>
    },
    {
      header: 'Consignee (Receiver)',
      accessor: 'consigneeName',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800 block text-xs truncate max-w-[140px]">{row.consigneeName}</span>
          <span className="text-[10px] text-slate-400 font-mono">{row.receiverName || 'Not Verified'}</span>
        </div>
      )
    },
    {
      header: 'Destination',
      accessor: 'destination',
      render: (row) => <span className="text-xs text-slate-700 font-medium">{row.destination}</span>
    },
    {
      header: 'Packages',
      accessor: 'shipmentPackages',
      align: 'center',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          {row.deliveredPackages || 0} / {row.shipmentPackages} Boxes
        </span>
      )
    },
    {
      header: 'Delivery Date',
      accessor: 'deliveryDate',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatDate(row.deliveryDate)}</span>
    },
    {
      header: 'POD Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Uploaded By',
      accessor: 'uploadedBy',
      render: (row) => <span className="text-xs text-slate-500">{row.uploadedBy || 'N/A'}</span>
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.status !== 'Verified' && (
            <button
              onClick={async () => {
                try {
                  await podService.verifyPOD(row.cnNumber);
                  setToastMessage(`Consignment ${row.cnNumber} marked Verified & Delivered!`);
                  fetchPODData();
                  setTimeout(() => setToastMessage(''), 4000);
                } catch (err) {
                  alert(`Failed to verify POD: ${err.message}`);
                }
              }}
              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
              title="Mark Verified & Delivered"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => navigate(`/admin/pod/${row.cnNumber}`)}
            className="p-1.5 text-slate-500 hover:text-setu-600 hover:bg-slate-100 rounded transition-colors"
            title="Review & Verify POD"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setTargetShipmentId(row.shipmentId);
              setTargetCN(row.cnNumber);
              setShowUploadModal(true);
            }}
            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded transition-colors"
            title="Upload / Re-Upload POD Scan"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="POD & Delivery Management"
        description="Monitor Proof of Delivery (POD) scans, package count matches, and verify receiver signatures."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'POD Management']}
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setTargetShipmentId('');
                setTargetCN('');
                setShowUploadModal(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-xs transition-colors flex-1 sm:flex-initial"
            >
              <Upload className="w-4 h-4" />
              <span>Upload POD Document</span>
            </button>

            <button
              onClick={() => navigate('/admin/pod/pending')}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold text-setu-700 bg-setu-50 border border-setu-200 hover:bg-setu-100 rounded-md transition-colors flex-1 sm:flex-initial"
            >
              <Clock className="w-4 h-4 text-setu-600" />
              <span>Pending POD Audit Queue</span>
            </button>
          </div>
        }
      />

      {/* POD TOP KPI STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
        <KPICard title="POD Pending" value={pods.filter((p) => p.status === 'Pending').length} subtext="Awaiting delivery scan" icon={Clock} variant="warning" />
        <KPICard title="Uploaded" value={pods.filter((p) => p.status === 'Uploaded').length} subtext="Uploaded via app/scanner" icon={Upload} variant="default" />
        <KPICard title="Needs Review" value={pods.filter((p) => p.status === 'Needs Review').length} subtext="Awaiting admin verification" icon={AlertTriangle} variant="accent" />
        <KPICard title="Verified" value={pods.filter((p) => p.status === 'Verified').length} subtext="Approved delivery ePODs" icon={CheckCircle2} variant="default" />
        <KPICard title="Missing / Rejected" value={pods.filter((p) => p.status === 'Missing' || p.status === 'Rejected').length} subtext="Require follow-up" icon={XCircle} variant="danger" />
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search CN number, company name, consignee, receiver name..."
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:items-center gap-2 w-full md:w-auto">
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full md:w-auto truncate"
            >
              <option value="All">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.companyName}>{c.companyName}</option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('All');
                setCompanyFilter('All');
              }}
              className="col-span-2 sm:col-span-1 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-md transition-colors text-center shrink-0"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="overflow-x-auto max-w-full pb-1">
            <FilterBar
              options={statusOptions}
              activeFilter={statusFilter}
              onSelectFilter={setStatusFilter}
            />
          </div>
          <span className="text-slate-500 font-medium shrink-0 text-[11px] sm:text-xs">
            Showing <strong>{pods.length}</strong> POD Records
          </span>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-900 text-white rounded-lg text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage('')} className="text-emerald-300 hover:text-white font-bold">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Multi-Selection Bulk Actions Floating Banner */}
      {selectedCNs.length > 0 && (
        <div className="bg-slate-900 text-white border border-slate-700 rounded-xl p-3 px-4 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full text-xs font-bold font-mono">
              {selectedCNs.length} Selected
            </span>
            <span className="text-xs text-slate-300 font-medium">
              POD records selected for bulk verification
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedCNs([])}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Clear Selection
            </button>

            <button
              disabled={verifyingBulk}
              onClick={handleBulkVerify}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {verifyingBulk
                  ? `Verifying (${selectedCNs.length})...`
                  : `Mark ${selectedCNs.length} Selected as Verified & Delivered`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* POD MASTER TABLE */}
      {loading ? (
        <LoadingState message="Loading Proof of Delivery Master Records..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPODData} />
      ) : (
        <DataTable
          columns={columns}
          data={pods}
          onRowClick={(row) => navigate(`/admin/pod/${row.cnNumber}`)}
          emptyMessage="No POD records found"
          emptySubtext="Try adjusting your search query or status filters."
        />
      )}

      {/* QUICK UPLOAD MODAL */}
      <PODUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        shipmentId={targetShipmentId}
        cnNumber={targetCN}
        onSuccess={fetchPODData}
      />
    </div>
  );
};
