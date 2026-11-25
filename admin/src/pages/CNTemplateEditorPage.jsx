import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileEdit,
  Save,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  History,
  Layout,
  Sliders,
  Building2,
  PlusCircle,
  Grid,
  Check,
  AlertCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Copy,
  FileText,
  Sparkles,
} from 'lucide-react';
import { ConsignmentNoteDocument } from '../components/cn/ConsignmentNoteDocument';
import {
  DEFAULT_CN_TEMPLATE_CONFIG,
  SAMPLE_CN_SCENARIOS,
  SHIPMENT_FIELD_MAPPINGS,
  PAGE_SIZE_PRESETS,
  cloneTemplateConfig,
  mergeWithDefaultTemplate,
} from '../cn/defaultCnTemplate';
import { computeCnLayout } from '../cn/cnLayoutEngine';
import { cnTemplateService } from '../services/cnTemplateService';
import { shipmentService } from '../services/shipmentService';
import logoImg from '../assets/logo2.png';

const FONT_OPTIONS = [
  { value: 'Arial, "Helvetica Neue", Helvetica, sans-serif', label: 'Arial / Helvetica (Default)' },
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif', label: 'Helvetica Neue' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New (Monospace)' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
];

const SECTION_GROUPS = [
  { key: 'header', label: 'Header & Branding' },
  { key: 'parties', label: 'Consignor & Consignee' },
  { key: 'metadata', label: 'CN Metadata & Routing' },
  { key: 'cargo', label: 'Packages, Weights & Description' },
  { key: 'invoices', label: 'Commercial Invoices & E-Way' },
  { key: 'freight', label: 'Freight & Charges Table' },
  { key: 'right', label: 'Acknowledgement' },
  { key: 'footer', label: 'Remarks, Signatures & Legal' },
];

export const CNTemplateEditorPage = () => {
  const navigate = useNavigate();

  // Template State
  const [template, setTemplate] = useState(() => cloneTemplateConfig(DEFAULT_CN_TEMPLATE_CONFIG));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(DEFAULT_CN_TEMPLATE_CONFIG));
  const [activeVersion, setActiveVersion] = useState(1);
  const [templateName, setTemplateName] = useState('Speed Setu Standard CN');
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [toast, setToast] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Editor UI State
  const [activeTab, setActiveTab] = useState('elements'); // 'page' | 'elements' | 'company' | 'add' | 'versions'
  const [selectedElementId, setSelectedElementId] = useState('invoice_numbers');
  const [previewMode, setPreviewMode] = useState('single'); // 'single' | 'split'
  const [zoom, setZoom] = useState(0.75);
  const [showGrid, setShowGrid] = useState(false);
  const [logoBase64, setLogoBase64] = useState(logoImg);

  // Sample & Real Shipment Preview State
  const [scenarioKey, setScenarioKey] = useState('ten_invoices');
  const [realShipments, setRealShipments] = useState([]);
  const [selectedRealShipmentId, setSelectedRealShipmentId] = useState('');
  const [customTestDesc, setCustomTestDesc] = useState('');
  const [customInvoiceCount, setCustomInvoiceCount] = useState('');

  // Add Custom Element Form State
  const [newElForm, setNewElForm] = useState({
    type: 'text_field',
    label: 'Custom Reference',
    fieldMapping: '',
    defaultValue: 'N/A',
    placement: 'floating',
    x: 50,
    y: 785,
    width: 240,
    height: 36,
    fontSize: 13,
    fontWeight: '600',
    align: 'left',
    showBorder: true,
    borderThickness: 1.0,
    prefix: '',
    suffix: '',
  });

  // Reset confirmation modal
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const showToastMsg = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load logo base64 once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        setLogoBase64(c.toDataURL('image/png', 1.0));
      } catch (e) {}
    };
    img.src = logoImg;
  }, []);

  // Load active template, version history, and sample real shipments
  const loadEditorData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [activeRes, versionsRes, shipmentsRes] = await Promise.all([
        cnTemplateService.getActiveTemplate().catch(() => null),
        cnTemplateService.getVersions().catch(() => []),
        shipmentService.getShipments().catch(() => []),
      ]);

      if (activeRes?.config) {
        const merged = mergeWithDefaultTemplate(activeRes.config);
        setTemplate(merged);
        setSavedSnapshot(JSON.stringify(merged));
        setActiveVersion(activeRes.version || 1);
        setTemplateName(activeRes.name || 'Speed Setu Standard CN');
      } else {
        const def = cloneTemplateConfig(DEFAULT_CN_TEMPLATE_CONFIG);
        setTemplate(def);
        setSavedSnapshot(JSON.stringify(def));
      }

      if (Array.isArray(versionsRes)) {
        setVersions(versionsRes);
      }

      if (Array.isArray(shipmentsRes)) {
        setRealShipments(shipmentsRes.slice(0, 20));
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load CN template configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEditorData();
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(template) !== savedSnapshot,
    [template, savedSnapshot]
  );

  // Build active preview shipment (either sample scenario or selected real shipment, with optional live tweaks)
  const previewShipment = useMemo(() => {
    let base;
    if (scenarioKey === 'real' && selectedRealShipmentId) {
      base =
        realShipments.find(
          (s) => s._id === selectedRealShipmentId || s.cnNumber === selectedRealShipmentId
        ) || SAMPLE_CN_SCENARIOS.single_short.shipment;
    } else {
      base = (SAMPLE_CN_SCENARIOS[scenarioKey] || SAMPLE_CN_SCENARIOS.ten_invoices).shipment;
    }

    const cloned = JSON.parse(JSON.stringify(base));
    if (customTestDesc.trim()) {
      cloned.materialDescription = customTestDesc.trim();
    }
    const countNum = parseInt(customInvoiceCount, 10);
    if (!isNaN(countNum) && countNum > 0 && countNum <= 60) {
      cloned.commercialInvoices = Array.from({ length: countNum }, (_, idx) => ({
        invoiceNumber: `INV-TEST-${String(idx + 1).padStart(3, '0')}`,
        invoiceDate: cloned.cnDate || '2026-11-25',
        invoiceValue: 25000 + idx * 1000,
        invoiceQuantity: 100,
      }));
      cloned.invoiceDetails = {
        ...cloned.invoiceDetails,
        invoiceNumber: cloned.commercialInvoices.map((i) => i.invoiceNumber).join(', '),
      };
    }
    return cloned;
  }, [scenarioKey, selectedRealShipmentId, realShipments, customTestDesc, customInvoiceCount]);

  const layoutInfo = useMemo(
    () => computeCnLayout(template, previewShipment),
    [template, previewShipment]
  );

  // Selected element lookup (standard or custom)
  const selectedElement = useMemo(() => {
    const std = (template.elements || []).find((el) => el.id === selectedElementId);
    if (std) return { ...std, isCustom: false };
    const cust = (template.customElements || []).find((el) => el.id === selectedElementId);
    if (cust) return { ...cust, isCustom: true };
    return null;
  }, [template, selectedElementId]);

  // Updaters
  const updatePage = (patch) => {
    setTemplate((prev) => ({
      ...prev,
      page: { ...prev.page, ...patch },
    }));
  };

  const updateCompanyInfo = (patch) => {
    setTemplate((prev) => ({
      ...prev,
      companyInfo: { ...prev.companyInfo, ...patch },
    }));
  };

  const updateElement = (id, patch, isCustom = false) => {
    setTemplate((prev) => {
      if (isCustom) {
        return {
          ...prev,
          customElements: (prev.customElements || []).map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        };
      }
      return {
        ...prev,
        elements: (prev.elements || []).map((el) =>
          el.id === id ? { ...el, ...patch } : el
        ),
      };
    });
  };

  const moveRowOrder = (id, direction, isCustom = false) => {
    setTemplate((prev) => {
      const flowList = [
        ...(prev.elements || []).filter((e) => e.section === 'cargo' || e.section === 'invoices'),
        ...(prev.customElements || []).filter((c) => c.type === 'table_row' && c.placement === 'left_table'),
      ].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

      const idx = flowList.findIndex((item) => item.id === id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= flowList.length) return prev;

      const curOrder = flowList[idx].order ?? idx + 1;
      const targetOrder = flowList[swapIdx].order ?? swapIdx + 1;
      const swapId = flowList[swapIdx].id;

      const patchOrder = (list) =>
        list.map((item) => {
          if (item.id === id) return { ...item, order: targetOrder };
          if (item.id === swapId) return { ...item, order: curOrder };
          return item;
        });

      return {
        ...prev,
        elements: patchOrder(prev.elements || []),
        customElements: patchOrder(prev.customElements || []),
      };
    });
  };

  const handleAddCustomElement = () => {
    const newId = `custom_${Date.now()}`;
    const nextOrder =
      Math.max(
        11,
        ...(template.elements || []).map((e) => e.order || 0),
        ...(template.customElements || []).map((c) => c.order || 0)
      ) + 1;

    const item = {
      id: newId,
      type: newElForm.type,
      label: newElForm.label.trim() || 'Custom Field',
      fieldMapping: newElForm.fieldMapping,
      defaultValue: newElForm.defaultValue,
      placement: newElForm.type === 'table_row' ? newElForm.placement || 'left_table' : 'floating',
      order: nextOrder,
      visible: true,
      x: Number(newElForm.x) || 50,
      y: Number(newElForm.y) || 785,
      xOffset: 0,
      yOffset: 0,
      width: Number(newElForm.width) || 240,
      height: Number(newElForm.height) || 34,
      fontSize: Number(newElForm.fontSize) || 13,
      valueFontSize: Number(newElForm.fontSize) || 13,
      fontWeight: newElForm.fontWeight || '600',
      align: newElForm.align || 'left',
      paddingTop: 5,
      paddingRight: 8,
      paddingBottom: 5,
      paddingLeft: 8,
      showBorder: Boolean(newElForm.showBorder),
      borderThickness: Number(newElForm.borderThickness) || 1.0,
      prefix: newElForm.prefix || '',
      suffix: newElForm.suffix || '',
    };

    setTemplate((prev) => ({
      ...prev,
      customElements: [...(prev.customElements || []), item],
    }));
    setSelectedElementId(newId);
    setActiveTab('elements');
    showToastMsg(`Added "${item.label}" to CN template.`);
  };

  const handleDeleteCustomElement = (id) => {
    setTemplate((prev) => ({
      ...prev,
      customElements: (prev.customElements || []).filter((c) => c.id !== id),
    }));
    setSelectedElementId('invoice_numbers');
    showToastMsg('Custom element removed.');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateCompanyInfo({ logoUrl: reader.result, showLogo: true });
        showToastMsg('Custom logo uploaded to template.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const saved = await cnTemplateService.saveTemplate({
        name: templateName,
        config: template,
        changeNote: changeNote.trim() || undefined,
      });
      const merged = mergeWithDefaultTemplate(saved.config || template);
      setTemplate(merged);
      setSavedSnapshot(JSON.stringify(merged));
      setActiveVersion(saved.version || activeVersion + 1);
      setChangeNote('');
      const vList = await cnTemplateService.getVersions().catch(() => []);
      if (Array.isArray(vList)) setVersions(vList);
      showToastMsg(`Saved CN Template v${saved.version}! New CNs will use this template.`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save CN template.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setShowResetConfirm(false);
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await cnTemplateService.resetToDefault();
      const merged = mergeWithDefaultTemplate(res?.config || DEFAULT_CN_TEMPLATE_CONFIG);
      setTemplate(merged);
      setSavedSnapshot(JSON.stringify(merged));
      setActiveVersion(res?.version || activeVersion + 1);
      const vList = await cnTemplateService.getVersions().catch(() => []);
      if (Array.isArray(vList)) setVersions(vList);
      showToastMsg(`Template reset to default (saved as v${res?.version || activeVersion + 1}).`);
    } catch (err) {
      // Even if offline, allow resetting local draft
      const def = cloneTemplateConfig(DEFAULT_CN_TEMPLATE_CONFIG);
      setTemplate(def);
      setErrorMsg(err.message || 'Failed to save reset on server.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = async (ver) => {
    setSaving(true);
    setErrorMsg('');
    try {
      const restored = await cnTemplateService.restoreVersion(ver._id || ver.version);
      const merged = mergeWithDefaultTemplate(restored.config);
      setTemplate(merged);
      setSavedSnapshot(JSON.stringify(merged));
      setActiveVersion(restored.version);
      const vList = await cnTemplateService.getVersions().catch(() => []);
      if (Array.isArray(vList)) setVersions(vList);
      showToastMsg(`Restored v${ver.version} as active v${restored.version}.`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to restore version.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setTemplate(JSON.parse(savedSnapshot));
      showToastMsg('Reverted unsaved changes.');
    } else {
      navigate('/admin/shipments');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <Loader2 className="w-8 h-8 animate-spin text-setu-600" />
          <p className="text-sm font-semibold">Loading CN Template Editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Action Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-setu-600/10 border border-setu-600/20 flex items-center justify-center text-setu-600 shrink-0">
            <FileEdit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">CN Template Editor</h1>
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-setu-100 text-setu-700 border border-setu-200">
                Active v{activeVersion}
              </span>
              {isDirty && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Customize Consignment Note layout, page geometry, element styles, and dynamic fields. Existing generated CNs stay unchanged.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Optional version note..."
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg w-44 focus:ring-2 focus:ring-setu-500/20 focus:border-setu-500"
          />
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>{isDirty ? 'Discard' : 'Cancel'}</span>
          </button>
          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Template</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {toast && (
        <div
          className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-sm ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <Check className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {errorMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Split Workspace: Left Controls | Right Live CN Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* LEFT EDITOR PANEL (5 cols) */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[82vh]">
          {/* Navigation Tabs */}
          <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50 text-[11px] font-bold">
            {[
              { id: 'elements', label: 'Elements', icon: Sliders },
              { id: 'page', label: 'Page', icon: Layout },
              { id: 'company', label: 'Texts', icon: Building2 },
              { id: 'add', label: 'Add', icon: PlusCircle },
              { id: 'versions', label: 'Versions', icon: History },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2.5 px-1 border-b-2 transition-colors cursor-pointer ${
                    active
                      ? 'border-setu-600 text-setu-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable Tab Body */}
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {/* TAB 1: ELEMENTS & INDIVIDUAL INSPECTOR */}
            {activeTab === 'elements' && (
              <div className="space-y-4">
                <div className="text-[11px] text-slate-500 bg-blue-50/70 border border-blue-100 rounded-lg p-2.5">
                  Tip: Click any element in the list below or click directly on a section in the Live Preview to edit it.
                </div>

                {/* Selected Element Inspector */}
                {selectedElement && (
                  <div className="border border-setu-200 bg-setu-50/30 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-setu-100">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-setu-600 block">
                          {selectedElement.isCustom ? 'Custom Element' : `Section: ${selectedElement.section}`}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">
                          {selectedElement.label || selectedElement.id}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateElement(
                              selectedElement.id,
                              { visible: selectedElement.visible === false },
                              selectedElement.isCustom
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            selectedElement.visible !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {selectedElement.visible !== false ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Visible</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Hidden</span>
                            </>
                          )}
                        </button>
                        {selectedElement.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomElement(selectedElement.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 cursor-pointer"
                            title="Delete custom element"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Label & Secondary Label */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Field Label
                        </label>
                        <input
                          type="text"
                          value={selectedElement.label || ''}
                          onChange={(e) =>
                            updateElement(selectedElement.id, { label: e.target.value }, selectedElement.isCustom)
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                      {selectedElement.secondaryLabel !== undefined && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Secondary Label
                          </label>
                          <input
                            type="text"
                            value={selectedElement.secondaryLabel || ''}
                            onChange={(e) =>
                              updateElement(
                                selectedElement.id,
                                { secondaryLabel: e.target.value },
                                selectedElement.isCustom
                              )
                            }
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                      )}
                    </div>

                    {/* Custom Element Data Mapping */}
                    {selectedElement.isCustom && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Shipment Data Mapping
                          </label>
                          <select
                            value={selectedElement.fieldMapping || ''}
                            onChange={(e) =>
                              updateElement(selectedElement.id, { fieldMapping: e.target.value }, true)
                            }
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                          >
                            {SHIPMENT_FIELD_MAPPINGS.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Static / Fallback Value
                          </label>
                          <input
                            type="text"
                            value={selectedElement.defaultValue || ''}
                            onChange={(e) =>
                              updateElement(selectedElement.id, { defaultValue: e.target.value }, true)
                            }
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    )}

                    {/* Position & Row Ordering */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-slate-700">
                          Position & Offset
                        </label>
                        {(selectedElement.section === 'cargo' ||
                          selectedElement.section === 'invoices' ||
                          (selectedElement.isCustom && selectedElement.placement === 'left_table')) && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveRowOrder(selectedElement.id, 'up', selectedElement.isCustom)}
                              className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-0.5 cursor-pointer"
                            >
                              <ArrowUp className="w-3 h-3" /> Row Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveRowOrder(selectedElement.id, 'down', selectedElement.isCustom)}
                              className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-0.5 cursor-pointer"
                            >
                              <ArrowDown className="w-3 h-3" /> Row Down
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <div>
                          <span className="text-[10px] text-slate-500">X Offset</span>
                          <input
                            type="number"
                            value={Number(selectedElement.isCustom && selectedElement.placement === 'floating' ? selectedElement.x : selectedElement.xOffset) || 0}
                            onChange={(e) =>
                              updateElement(
                                selectedElement.id,
                                selectedElement.isCustom && selectedElement.placement === 'floating'
                                  ? { x: Number(e.target.value) }
                                  : { xOffset: Number(e.target.value) },
                                selectedElement.isCustom
                              )
                            }
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500">Y Offset</span>
                          <input
                            type="number"
                            value={Number(selectedElement.isCustom && selectedElement.placement === 'floating' ? selectedElement.y : selectedElement.yOffset) || 0}
                            onChange={(e) =>
                              updateElement(
                                selectedElement.id,
                                selectedElement.isCustom && selectedElement.placement === 'floating'
                                  ? { y: Number(e.target.value) }
                                  : { yOffset: Number(e.target.value) },
                                selectedElement.isCustom
                              )
                            }
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div className="flex items-center justify-center gap-1 pt-3">
                          {[
                            { icon: ArrowLeft, dx: -5, dy: 0 },
                            { icon: ArrowUp, dx: 0, dy: -5 },
                            { icon: ArrowDown, dx: 0, dy: 5 },
                            { icon: ArrowRight, dx: 5, dy: 0 },
                          ].map((btn, i) => {
                            const Icon = btn.icon;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  if (selectedElement.isCustom && selectedElement.placement === 'floating') {
                                    updateElement(
                                      selectedElement.id,
                                      {
                                        x: (Number(selectedElement.x) || 0) + btn.dx,
                                        y: (Number(selectedElement.y) || 0) + btn.dy,
                                      },
                                      true
                                    );
                                  } else {
                                    updateElement(
                                      selectedElement.id,
                                      {
                                        xOffset: (Number(selectedElement.xOffset) || 0) + btn.dx,
                                        yOffset: (Number(selectedElement.yOffset) || 0) + btn.dy,
                                      },
                                      selectedElement.isCustom
                                    );
                                  }
                                }}
                                className="p-1 bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                                title="Nudge position"
                              >
                                <Icon className="w-3 h-3" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Width & Height */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500">Width</label>
                        <input
                          type="number"
                          value={Number(selectedElement.width) || 200}
                          onChange={(e) =>
                            updateElement(
                              selectedElement.id,
                              { width: Math.max(40, Number(e.target.value)) },
                              selectedElement.isCustom
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">Min Height</label>
                        <input
                          type="number"
                          value={Number(selectedElement.height) || 28}
                          onChange={(e) =>
                            updateElement(
                              selectedElement.id,
                              { height: Math.max(18, Number(e.target.value)) },
                              selectedElement.isCustom
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                      {selectedElement.labelWidth !== undefined && (
                        <div>
                          <label className="block text-[10px] text-slate-500">Label Width</label>
                          <input
                            type="number"
                            value={Number(selectedElement.labelWidth) || 112}
                            onChange={(e) =>
                              updateElement(
                                selectedElement.id,
                                { labelWidth: Math.max(50, Number(e.target.value)) },
                                selectedElement.isCustom
                              )
                            }
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                      )}
                    </div>

                    {/* Typography */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500">Label Font (px)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="8"
                          max="48"
                          value={Number(selectedElement.fontSize) || 13}
                          onChange={(e) =>
                            updateElement(
                              selectedElement.id,
                              { fontSize: Number(e.target.value) },
                              selectedElement.isCustom
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">Value Font (px)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="8"
                          max="48"
                          value={Number(selectedElement.valueFontSize ?? selectedElement.fontSize) || 13}
                          onChange={(e) =>
                            updateElement(
                              selectedElement.id,
                              { valueFontSize: Number(e.target.value) },
                              selectedElement.isCustom
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">Font Weight</label>
                        <select
                          value={selectedElement.fontWeight || '600'}
                          onChange={(e) =>
                            updateElement(
                              selectedElement.id,
                              { fontWeight: e.target.value },
                              selectedElement.isCustom
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="400">Regular (400)</option>
                          <option value="500">Medium (500)</option>
                          <option value="600">SemiBold (600)</option>
                          <option value="700">Bold (700)</option>
                          <option value="800">ExtraBold (800)</option>
                        </select>
                      </div>
                    </div>

                    {/* Text Alignment & Border */}
                    <div className="grid grid-cols-2 gap-2 items-end">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Alignment</label>
                        <div className="grid grid-cols-3 border border-slate-300 rounded-lg overflow-hidden bg-white">
                          {['left', 'center', 'right'].map((al) => (
                            <button
                              key={al}
                              type="button"
                              onClick={() =>
                                updateElement(selectedElement.id, { align: al }, selectedElement.isCustom)
                              }
                              className={`py-1 text-[11px] font-semibold capitalize cursor-pointer ${
                                (selectedElement.align || 'left') === al
                                  ? 'bg-setu-600 text-white'
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {al}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedElement.showBorder !== false}
                            onChange={(e) =>
                              updateElement(
                                selectedElement.id,
                                { showBorder: e.target.checked },
                                selectedElement.isCustom
                              )
                            }
                            className="rounded border-slate-300 text-setu-600"
                          />
                          <span>Border</span>
                        </label>
                        <input
                          type="number"
                          step="0.2"
                          min="0.4"
                          max="5"
                          value={Number(selectedElement.borderThickness) || 1.0}
                          disabled={selectedElement.showBorder === false}
                          onChange={(e) =>
                            updateElement(
                              selectedElement.id,
                              { borderThickness: Number(e.target.value) },
                              selectedElement.isCustom
                            )
                          }
                          className="w-16 px-2 py-1 text-xs border border-slate-300 rounded-lg disabled:opacity-40"
                          title="Border thickness"
                        />
                      </div>
                    </div>

                    {/* Padding & Margin */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { key: 'paddingTop', label: 'Pad T' },
                        { key: 'paddingRight', label: 'Pad R' },
                        { key: 'paddingBottom', label: 'Pad B' },
                        { key: 'paddingLeft', label: 'Pad L' },
                      ].map((p) => (
                        <div key={p.key}>
                          <label className="block text-[10px] text-slate-500">{p.label}</label>
                          <input
                            type="number"
                            min="0"
                            max="40"
                            value={Number(selectedElement[p.key] ?? 4)}
                            onChange={(e) =>
                              updateElement(
                                selectedElement.id,
                                { [p.key]: Number(e.target.value) },
                                selectedElement.isCustom
                              )
                            }
                            className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500">Margin Top</label>
                        <input
                          type="number"
                          min="0"
                          max="40"
                          value={Number(selectedElement.marginTop ?? 0)}
                          onChange={(e) =>
                            updateElement(
                              selectedElement.id,
                              { marginTop: Number(e.target.value) },
                              selectedElement.isCustom
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">Margin Bottom</label>
                        <input
                          type="number"
                          min="0"
                          max="40"
                          value={Number(selectedElement.marginBottom ?? 0)}
                          onChange={(e) =>
                            updateElement(
                              selectedElement.id,
                              { marginBottom: Number(e.target.value) },
                              selectedElement.isCustom
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Grouped Section Elements List */}
                <div className="space-y-3">
                  {SECTION_GROUPS.map((grp) => {
                    const groupItems = (template.elements || []).filter((e) => e.section === grp.key);
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={grp.key} className="space-y-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                          {grp.label}
                        </div>
                        <div className="space-y-1">
                          {groupItems.map((el) => (
                            <div
                              key={el.id}
                              onClick={() => setSelectedElementId(el.id)}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                selectedElementId === el.id
                                  ? 'bg-setu-50 border-setu-300 text-setu-900 font-semibold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="truncate">{el.label || el.id}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateElement(el.id, { visible: el.visible === false });
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700"
                                title={el.visible !== false ? 'Hide element' : 'Show element'}
                              >
                                {el.visible !== false ? (
                                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {(template.customElements || []).length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-setu-600 px-1">
                        Custom Added Elements
                      </div>
                      {template.customElements.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedElementId(c.id)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                            selectedElementId === c.id
                              ? 'bg-setu-50 border-setu-300 text-setu-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">
                            {c.label} <span className="text-[10px] text-slate-400">({c.type})</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustomElement(c.id);
                            }}
                            className="p-1 text-rose-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: PAGE CONFIGURATION */}
            {activeTab === 'page' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Template Name</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Page Size</label>
                    <select
                      value={template.page.size || 'A4'}
                      onChange={(e) => updatePage({ size: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      {Object.entries(PAGE_SIZE_PRESETS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                      <option value="Custom">Custom Dimensions</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Orientation</label>
                    <div className="grid grid-cols-2 border border-slate-300 rounded-lg overflow-hidden">
                      {['landscape', 'portrait'].map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => updatePage({ orientation: o })}
                          className={`py-1.5 font-semibold capitalize cursor-pointer ${
                            template.page.orientation === o
                              ? 'bg-setu-600 text-white'
                              : 'bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Margins */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Page Margins (mm)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'marginTop', label: 'Top' },
                      { key: 'marginRight', label: 'Right' },
                      { key: 'marginBottom', label: 'Bottom' },
                      { key: 'marginLeft', label: 'Left' },
                    ].map((m) => (
                      <div key={m.key}>
                        <span className="text-[10px] text-slate-500">{m.label}</span>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={Number(template.page[m.key] ?? 3)}
                          onChange={(e) => updatePage({ [m.key]: Number(e.target.value) })}
                          className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Canvas Dimensions & Header/Footer Heights */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Document Width (px)</label>
                    <input
                      type="number"
                      min="900"
                      max="2200"
                      step="20"
                      value={Number(template.page.docWidth) || 1400}
                      onChange={(e) => updatePage({ docWidth: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Base Height (px)</label>
                    <input
                      type="number"
                      min="700"
                      max="2000"
                      step="20"
                      value={Number(template.page.docHeight) || 980}
                      onChange={(e) => updatePage({ docHeight: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Header Height (px)</label>
                    <input
                      type="number"
                      min="80"
                      max="240"
                      value={Number(template.page.headerHeight) || 125}
                      onChange={(e) => updatePage({ headerHeight: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Footer Height (px)</label>
                    <input
                      type="number"
                      min="150"
                      max="320"
                      value={Number(template.page.footerHeight) || 193}
                      onChange={(e) => updatePage({ footerHeight: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Typography & Borders */}
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Default Font Family</label>
                    <select
                      value={template.page.fontFamily}
                      onChange={(e) => updatePage({ fontFamily: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Default Font (px)</label>
                      <input
                        type="number"
                        min="9"
                        max="20"
                        value={Number(template.page.defaultFontSize) || 13}
                        onChange={(e) => updatePage({ defaultFontSize: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Line Spacing</label>
                      <input
                        type="number"
                        step="0.05"
                        min="1.05"
                        max="2.2"
                        value={Number(template.page.lineSpacing) || 1.32}
                        onChange={(e) => updatePage({ lineSpacing: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Brand Color</label>
                      <input
                        type="color"
                        value={template.page.brandColor || '#0B315B'}
                        onChange={(e) => updatePage({ brandColor: e.target.value })}
                        className="w-full h-7 border border-slate-300 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Outer Border Thickness</label>
                      <input
                        type="number"
                        step="0.2"
                        min="0.5"
                        max="5"
                        value={Number(template.page.borderThickness) || 1.8}
                        onChange={(e) => updatePage({ borderThickness: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Inner Grid Thickness</label>
                      <input
                        type="number"
                        step="0.2"
                        min="0.4"
                        max="4"
                        value={Number(template.page.thinBorderThickness) || 1.0}
                        onChange={(e) => updatePage({ thinBorderThickness: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Cell Padding X (px)</label>
                      <input
                        type="number"
                        min="2"
                        max="30"
                        value={Number(template.page.cellPaddingX) ?? 10}
                        onChange={(e) => updatePage({ cellPaddingX: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Cell Padding Y (px)</label>
                      <input
                        type="number"
                        min="2"
                        max="24"
                        value={Number(template.page.cellPaddingY) ?? 6}
                        onChange={(e) => updatePage({ cellPaddingY: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Invoice / Cargo Column Width (px)
                    </label>
                    <input
                      type="number"
                      min="340"
                      max="680"
                      step="10"
                      value={Number(template.page.leftColWidth) || 455}
                      onChange={(e) => updatePage({ leftColWidth: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Wider column fits more invoice numbers per line before wrapping.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: COMPANY INFO, LOGO & LEGAL TEXTS */}
            {activeTab === 'company' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Company Logo</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={template.companyInfo.showLogo !== false}
                        onChange={(e) => updateCompanyInfo({ showLogo: e.target.checked })}
                      />
                      <span>Show Logo</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold cursor-pointer hover:bg-slate-100">
                      Upload Logo
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                    {template.companyInfo.logoUrl && (
                      <button
                        type="button"
                        onClick={() => updateCompanyInfo({ logoUrl: '' })}
                        className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold cursor-pointer"
                      >
                        Reset Logo
                      </button>
                    )}
                  </div>
                </div>

                {[
                  { key: 'companyName', label: 'Company Name' },
                  { key: 'companyAddress', label: 'Company Address' },
                  { key: 'companyContact', label: 'Customer Care / Contact Info' },
                  { key: 'companyEmailWeb', label: 'Email & Website' },
                  { key: 'cnTitle', label: 'Document Title' },
                  { key: 'companyGstin', label: 'Company GSTIN' },
                  { key: 'riskNotice', label: 'Risk Notice Subtitle' },
                  { key: 'signatureForLabel', label: 'Signatory Company Line' },
                  { key: 'demurrageTitle', label: 'Demurrage Heading' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block font-semibold text-slate-700 mb-1">{f.label}</label>
                    <input
                      type="text"
                      value={template.companyInfo[f.key] || ''}
                      onChange={(e) => updateCompanyInfo({ [f.key]: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                ))}

                {[
                  { key: 'demurrageText', label: 'Demurrage Clause', rows: 2 },
                  { key: 'noticeText', label: 'Bank / Delivery Notice', rows: 3 },
                  { key: 'cubicFeetNote', label: 'Cubic Feet & Receipt Note', rows: 2 },
                  { key: 'cenvatText', label: 'CENVAT Certification Text', rows: 4 },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block font-semibold text-slate-700 mb-1">{f.label}</label>
                    <textarea
                      rows={f.rows}
                      value={template.companyInfo[f.key] || ''}
                      onChange={(e) => updateCompanyInfo({ [f.key]: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* TAB 4: ADD NEW FORM ELEMENTS */}
            {activeTab === 'add' && (
              <div className="space-y-3 text-xs">
                <p className="text-[11px] text-slate-500">
                  Add custom fields, table rows, notes, or numeric blocks and optionally bind them to live shipment data.
                </p>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Element Type</label>
                  <select
                    value={newElForm.type}
                    onChange={(e) => setNewElForm({ ...newElForm, type: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="text_field">Additional Text Field</option>
                    <option value="custom_label">Custom Label</option>
                    <option value="info_section">Additional Information Section</option>
                    <option value="table_row">Custom Table Row</option>
                    <option value="note">Additional Note</option>
                    <option value="numeric_field">Custom Numeric Field</option>
                  </select>
                </div>

                {newElForm.type === 'table_row' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Table Placement</label>
                    <select
                      value={newElForm.placement}
                      onChange={(e) => setNewElForm({ ...newElForm, placement: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="left_table">Cargo & Invoices Table (Left Column)</option>
                      <option value="freight_table">Freight & Charges Table (Center Column)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Label / Title</label>
                  <input
                    type="text"
                    value={newElForm.label}
                    onChange={(e) => setNewElForm({ ...newElForm, label: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Map to Shipment Data</label>
                  <select
                    value={newElForm.fieldMapping}
                    onChange={(e) => setNewElForm({ ...newElForm, fieldMapping: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    {SHIPMENT_FIELD_MAPPINGS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Static / Fallback Value
                  </label>
                  <input
                    type="text"
                    value={newElForm.defaultValue}
                    onChange={(e) => setNewElForm({ ...newElForm, defaultValue: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>

                {newElForm.type === 'numeric_field' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Prefix (e.g. ₹)</label>
                      <input
                        type="text"
                        value={newElForm.prefix}
                        onChange={(e) => setNewElForm({ ...newElForm, prefix: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Suffix (e.g. Kg)</label>
                      <input
                        type="text"
                        value={newElForm.suffix}
                        onChange={(e) => setNewElForm({ ...newElForm, suffix: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {newElForm.type !== 'table_row' && (
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500">X</label>
                      <input
                        type="number"
                        value={newElForm.x}
                        onChange={(e) => setNewElForm({ ...newElForm, x: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Y</label>
                      <input
                        type="number"
                        value={newElForm.y}
                        onChange={(e) => setNewElForm({ ...newElForm, y: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Width</label>
                      <input
                        type="number"
                        value={newElForm.width}
                        onChange={(e) => setNewElForm({ ...newElForm, width: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Height</label>
                      <input
                        type="number"
                        value={newElForm.height}
                        onChange={(e) => setNewElForm({ ...newElForm, height: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddCustomElement}
                  className="w-full py-2 bg-setu-600 hover:bg-setu-700 text-white font-bold rounded-lg inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Element to CN Template</span>
                </button>
              </div>
            )}

            {/* TAB 5: VERSION HISTORY */}
            {activeTab === 'versions' && (
              <div className="space-y-2.5 text-xs">
                <p className="text-[11px] text-slate-500">
                  Every save creates an immutable version. Historical CNs retain the exact template snapshot used when they were generated.
                </p>
                {versions.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 border border-dashed border-slate-300 rounded-lg">
                    No saved versions yet. Save changes to create Version 1.
                  </div>
                ) : (
                  versions.map((v) => (
                    <div
                      key={v._id || v.version}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                        v.isActive ? 'bg-setu-50 border-setu-300' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">v{v.version}</span>
                          {v.isActive && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded">
                              ACTIVE
                            </span>
                          )}
                          {v.isDefault && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 truncate mt-0.5">
                          {v.changeNote || v.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {v.createdBy || 'Admin'} • {v.createdAt ? new Date(v.createdAt).toLocaleString('en-IN') : ''}
                        </p>
                      </div>
                      {!v.isActive && (
                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(v)}
                          disabled={saving}
                          className="px-2.5 py-1 text-[11px] font-bold text-setu-700 bg-white border border-setu-300 hover:bg-setu-50 rounded-lg shrink-0 cursor-pointer"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT LIVE PREVIEW PANEL (7 cols) */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Preview Controls Toolbar */}
          <div className="p-3 bg-slate-900 text-white border-b border-slate-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold">Live CN Preview</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {layoutInfo.docWidth} × {Math.round(layoutInfo.totalDocHeight)} px
                  {layoutInfo.isOverflowing ? ' (Multi-page)' : ' (Single Page)'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Preview Mode Toggle */}
                <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('single')}
                    className={`px-2 py-1 rounded-md cursor-pointer ${
                      previewMode === 'single' ? 'bg-setu-600 text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3 h-3 inline mr-1" />
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('split')}
                    className={`px-2 py-1 rounded-md cursor-pointer ${
                      previewMode === 'split' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Copy className="w-3 h-3 inline mr-1" />
                    2-in-1
                  </button>
                </div>

                {/* Grid Toggle */}
                <button
                  type="button"
                  onClick={() => setShowGrid(!showGrid)}
                  className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                    showGrid
                      ? 'bg-setu-600 border-setu-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="Toggle alignment grid"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>

                {/* Zoom Controls */}
                <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-0.5 gap-1">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
                    className="p-0.5 text-slate-300 hover:text-white cursor-pointer"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono w-10 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
                    className="p-0.5 text-slate-300 hover:text-white cursor-pointer"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Sample Data & Stress Test Switcher */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div>
                <select
                  value={scenarioKey}
                  onChange={(e) => {
                    setScenarioKey(e.target.value);
                    setCustomInvoiceCount('');
                    setCustomTestDesc('');
                  }}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                >
                  {Object.entries(SAMPLE_CN_SCENARIOS).map(([k, v]) => (
                    <option key={k} value={k}>
                      Sample: {v.label}
                    </option>
                  ))}
                  {realShipments.length > 0 && (
                    <option value="real">Real Shipment Record...</option>
                  )}
                </select>
              </div>

              {scenarioKey === 'real' ? (
                <div className="sm:col-span-2">
                  <select
                    value={selectedRealShipmentId}
                    onChange={(e) => setSelectedRealShipmentId(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                  >
                    <option value="">Select shipment...</option>
                    {realShipments.map((s) => (
                      <option key={s._id || s.cnNumber} value={s._id || s.cnNumber}>
                        {s.cnNumber} — {s.consignor?.name || s.companyName} ({(s.commercialInvoices || []).length || 1} inv)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={customInvoiceCount}
                      onChange={(e) => setCustomInvoiceCount(e.target.value)}
                      placeholder="Override invoice count (1-60)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={customTestDesc}
                      onChange={(e) => setCustomTestDesc(e.target.value)}
                      placeholder="Override Description of Goods..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Interactive Live Canvas Viewport */}
          <div className="bg-slate-200/80 p-4 overflow-auto max-h-[72vh] flex justify-center items-start">
            <div
              style={{
                width: `${Math.round(1050 * zoom)}px`,
                minWidth: `${Math.round(1050 * zoom)}px`,
              }}
              className="transition-all duration-150"
            >
              {previewMode === 'single' ? (
                <div className="bg-white shadow-xl rounded-sm overflow-hidden border border-slate-300">
                  <ConsignmentNoteDocument
                    template={template}
                    shipment={previewShipment}
                    logoSrc={logoBase64}
                    interactive={true}
                    selectedElementId={selectedElementId}
                    onSelectElement={(id) => {
                      setSelectedElementId(id);
                      setActiveTab('elements');
                    }}
                    showGrid={showGrid}
                  />
                </div>
              ) : (
                <div className="bg-white shadow-xl rounded-sm p-3 border border-slate-300 space-y-2">
                  <ConsignmentNoteDocument
                    template={template}
                    shipment={previewShipment}
                    logoSrc={logoBase64}
                    interactive={true}
                    selectedElementId={selectedElementId}
                    onSelectElement={(id) => {
                      setSelectedElementId(id);
                      setActiveTab('elements');
                    }}
                    showGrid={showGrid}
                  />
                  <div className="border-t-2 border-dashed border-slate-500 my-1 text-center text-[9px] font-bold text-slate-500 pt-1">
                    - - - CUT HERE FOR DUPLICATE COPY - - -
                  </div>
                  <ConsignmentNoteDocument
                    template={template}
                    shipment={previewShipment}
                    logoSrc={logoBase64}
                    interactive={false}
                    showGrid={showGrid}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reset to Default Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Reset CN Template to Default?</h3>
                <p className="text-xs text-slate-600 mt-1">
                  This will restore the Speed Setu default CN layout as a new active version. All previous versions remain in Version History, and previously generated CNs will not be modified.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
