import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { podService } from '../services/podService';
import { formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { PODUploadModal } from '../components/pod/PODUploadModal';
import { Upload, Eye, ArrowLeft, Clock } from 'lucide-react';

export const PendingPODPage = () => {
  const navigate = useNavigate();
  const [pendingPods, setPendingPods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Quick upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [targetShipmentId, setTargetShipmentId] = useState('');
  const [targetCN, setTargetCN] = useState('');

  const fetchPendingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await podService.getPendingPODs();
      setPendingPods(data);
    } catch (err) {
      setError(err.message || 'Failed to load pending POD queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingData();
  }, []);

  const columns = [
    {
      header: 'CN Number',
      accessor: 'cnNumber',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/shipments/${row.shipmentId}`)}
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
      header: 'Consignee',
      accessor: 'consigneeName',
      render: (row) => <span className="font-semibold text-slate-800 text-xs">{row.consigneeName}</span>
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
      render: (row) => <span className="font-mono text-xs font-bold text-slate-800">{row.shipmentPackages} Boxes</span>
    },
    {
      header: 'Delivery Date',
      accessor: 'deliveryDate',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatDate(row.deliveryDate)}</span>
    },
    {
      header: 'Trip Reference',
      accessor: 'tripId',
      render: (row) => <span className="font-mono text-xs text-setu-700 font-bold">{row.tripId || 'N/A'}</span>
    },
    {
      header: 'POD Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setTargetShipmentId(row.shipmentId);
              setTargetCN(row.cnNumber);
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded transition-colors shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload POD</span>
          </button>
          <button
            onClick={() => navigate(`/admin/shipments/${row.shipmentId}`)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
            title="View Shipment Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending POD Audit Queue"
        description="Review shipments delivered or awaiting Proof of Delivery scans before customer billing."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'POD Management', 'Pending Queue']}
        actions={
          <button
            onClick={() => navigate('/admin/pod')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to POD Overview</span>
          </button>
        }
      />

      {loading ? (
        <LoadingState message="Loading Pending POD Queue..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPendingData} />
      ) : (
        <DataTable
          columns={columns}
          data={pendingPods}
          onRowClick={(row) => navigate(`/admin/pod/${row.cnNumber}`)}
          emptyMessage="No pending PODs in queue"
          emptySubtext="All delivered shipments currently have verified Proof of Delivery documents."
        />
      )}

      <PODUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        shipmentId={targetShipmentId}
        cnNumber={targetCN}
        onSuccess={fetchPendingData}
      />
    </div>
  );
};
