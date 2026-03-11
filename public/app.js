const API = '/api/candidates';
const API_STATS = '/api/candidates/stats/summary';

let allCandidates = [];
let editingId = null;

// ── DOM refs ──────────────────────────────────────────────
const form              = document.getElementById('candidate-form');
const formTitle         = document.getElementById('form-title');
const submitBtn         = document.getElementById('submit-btn');
const cancelBtn         = document.getElementById('cancel-btn');
const messageEl         = document.getElementById('message');
const tbody             = document.getElementById('candidates-body');
const duplicateWarning  = document.getElementById('duplicate-warning');
const duplicateInfo     = document.getElementById('duplicate-info');

const searchInput            = document.getElementById('search');
const filterResultInput      = document.getElementById('filterResult');
const filterFacilityInput    = document.getElementById('filterFacility');
const filterInterviewInput   = document.getElementById('filterInterviewStatus');

// ── Bootstrap ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadCandidates();
  setupEventListeners();
});

function setupEventListeners() {
  form.addEventListener('submit', submitForm);
  cancelBtn.addEventListener('click', resetForm);
  searchInput.addEventListener('input', applyFilters);
  filterResultInput.addEventListener('change', applyFilters);
  filterFacilityInput.addEventListener('change', applyFilters);
  filterInterviewInput.addEventListener('change', applyFilters);
  
  // Auto-uppercase FIN
  document.getElementById('fin').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
}

// ── Load Dashboard Stats ──────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch(API_STATS);
    if (!res.ok) throw new Error('Failed to fetch stats');
    const stats = await res.json();
    
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-recruited').textContent = stats.recruited;
    document.getElementById('stat-failed').textContent = stats.failed;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-passed').textContent = stats.passed;
    
    // Facility stats
    if (stats.byFacility && stats.byFacility.length > 0) {
      const facilityStatsHtml = '<h4>Statistics by Facility</h4>' + stats.byFacility.map(f => `
        <div class="facility-bar">
          <div class="facility-name">Facility ${f._id}</div>
          <div class="facility-bar-container">
            <div class="facility-bar-segment" style="width: ${(f.passed / f.total * 100)}%; background: #4caf50;" title="Passed">
              ${f.passed > 0 ? f.passed : ''}
            </div>
            <div class="facility-bar-segment" style="width: ${(f.failed / f.total * 100)}%; background: #f44336;" title="Failed">
              ${f.failed > 0 ? f.failed : ''}
            </div>
            <div class="facility-bar-segment" style="width: ${(f.pending / f.total * 100)}%; background: #ff9800;" title="Pending">
              ${f.pending > 0 ? f.pending : ''}
            </div>
          </div>
          <div class="facility-bar-total">${f.total} total</div>
        </div>
      `).join('');
      document.getElementById('facility-stats').innerHTML = facilityStatsHtml;
    }
  } catch (err) {
    console.error('Stats error:', err.message);
  }
}

// ── Load all candidates ────────────────────────────────────
async function loadCandidates() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error('Failed to fetch candidates');
    allCandidates = await res.json();
    applyFilters();
    loadStats();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

// ── Apply all filters ─────────────────────────────────────
function applyFilters() {
  const search = searchInput.value.toLowerCase().trim();
  const resultFilter = filterResultInput.value;
  const facilityFilter = filterFacilityInput.value;
  const interviewFilter = filterInterviewInput.value;
  
  let filtered = allCandidates.filter(c => {
    const matchesSearch = !search || 
      c.name.toLowerCase().includes(search) ||
      c.fin.toLowerCase().includes(search) ||
      (c.positionAppliedFor || '').toLowerCase().includes(search);
    
    const matchesResult = !resultFilter || c.result === resultFilter;
    const matchesFacility = !facilityFilter || c.facility === facilityFilter;
    const matchesInterview = !interviewFilter || c.interviewStatus === interviewFilter;
    
    return matchesSearch && matchesResult && matchesFacility && matchesInterview;
  });
  
  renderTable(filtered);
}

// ── Render table ───────────────────────────────────────────
function renderTable(candidates) {
  document.getElementById('candidate-count').textContent = `${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}`;
  
  if (!candidates.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="loading">No candidates found.</td></tr>';
    return;
  }

  tbody.innerHTML = candidates.map(c => `
    <tr data-id="${c._id}">
      <td><strong>${escape(c.fin)}</strong></td>
      <td>${escape(c.name)}</td>
      <td>${escape(c.positionAppliedFor || '—')}</td>
      <td><strong>Facility ${c.facility}</strong></td>
      <td><span class="badge badge-${c.result}">${c.result}</span></td>
      <td>${c.interviewStatus}</td>
      <td>${escape(c.phone || '—')}</td>
      <td>
        ${c.cvPath ? `<a href="${c.cvPath}" target="_blank" class="btn btn-view btn-small">CV</a>` : ''}
        ${c.idPath ? `<a href="${c.idPath}" target="_blank" class="btn btn-view btn-small">ID</a>` : ''}
      </td>
      <td class="actions">
        <button class="btn btn-edit"   onclick="startEdit('${c._id}')">Edit</button>
        <button class="btn btn-delete" onclick="deleteCandidate('${c._id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

// ── Check for duplicate FIN ────────────────────────────────
async function checkDuplicate(fin) {
  if (!fin.trim()) return null;
  const existing = allCandidates.find(c => c.fin.toUpperCase() === fin.toUpperCase() && c._id !== editingId);
  return existing || null;
}

// ── Close duplicate warning ────────────────────────────────
function closeDuplicateWarning() {
  duplicateWarning.classList.add('hidden');
}

// ── Submit form (create or update) ────────────────────────
async function submitForm(e) {
  e.preventDefault();
  closeDuplicateWarning();

  const fin = document.getElementById('fin').value.toUpperCase().trim();
  const result = document.getElementById('result').value;
  const rejectionReason = document.getElementById('rejectionReason').value;

  // Validate rejection reason if result is Fail
  if (result === 'Fail' && !rejectionReason.trim()) {
    showMessage('Reason for rejection is required when result is Fail', 'error');
    return;
  }

  // Check for duplicates (only on create)
  if (!editingId) {
    const duplicate = await checkDuplicate(fin);
    if (duplicate) {
      showDuplicateWarning(duplicate);
      return;
    }
  }

  const formData = new FormData(form);
  formData.set('fin', fin); // Ensure uppercase

  try {
    let res;
    if (editingId) {
      res = await fetch(`${API}/${editingId}`, { method: 'PUT', body: formData });
    } else {
      res = await fetch(API, { method: 'POST', body: formData });
    }

    const data = await res.json();
    
    if (res.status === 409) {
      // Duplicate error from server
      showDuplicateWarning(data.duplicate);
      return;
    }
    
    if (!res.ok) throw new Error(data.error || 'Request failed');

    showMessage(
      editingId ? 'Candidate updated successfully.' : 'Candidate added successfully.',
      'success'
    );
    resetForm();
    loadCandidates();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

// ── Show duplicate warning ─────────────────────────────────
function showDuplicateWarning(duplicate) {
  duplicateInfo.innerHTML = `
    <strong>Name:</strong> ${escape(duplicate.name)} | 
    <strong>Facility:</strong> ${duplicate.facility} | 
    <strong>Result:</strong> ${duplicate.result} | 
    <strong>Status:</strong> ${duplicate.recruitmentStatus}
  `;
  duplicateWarning.classList.remove('hidden');
}

// ── Populate form for editing ──────────────────────────────
function startEdit(id) {
  const c = allCandidates.find(x => x._id === id);
  if (!c) return;

  editingId = id;
  formTitle.textContent = 'Edit Candidate';
  submitBtn.textContent = 'Update Candidate';
  cancelBtn.style.display = 'inline-block';

  // Candidate Information
  document.getElementById('fin').value = c.fin || '';
  document.getElementById('name').value = c.name || '';
  document.getElementById('phone').value = c.phone || '';
  document.getElementById('sourceOfApplication').value = c.sourceOfApplication || 'Walk-in';
  document.getElementById('transportRequired').value = String(c.transportRequired || false);
  document.getElementById('busRoute').value = c.busRoute || '';

  // Interview & Assessment
  document.getElementById('facility').value = c.facility || '';
  document.getElementById('positionAppliedFor').value = c.positionAppliedFor || '';
  document.getElementById('department').value = c.department || '';
  document.getElementById('interviewDate').value = c.interviewDate ? c.interviewDate.split('T')[0] : '';
  document.getElementById('interviewedBy').value = c.interviewedBy || '';
  document.getElementById('interviewStatus').value = c.interviewStatus || 'Pending';
  document.getElementById('result').value = c.result || 'Pending';
  document.getElementById('rejectionReason').value = c.rejectionReason || '';
  document.getElementById('interviewerComments').value = c.interviewerComments || '';

  // Onboarding & Final Status
  document.getElementById('recruitmentStatus').value = c.recruitmentStatus || 'Not Recruited';
  document.getElementById('dateOfRecruitment').value = c.dateOfRecruitment ? c.dateOfRecruitment.split('T')[0] : '';
  document.getElementById('remarks').value = c.remarks || '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Delete ─────────────────────────────────────────────────
async function deleteCandidate(id) {
  if (!confirm('Are you sure? This will permanently delete this candidate record.')) return;

  try {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');
    showMessage('Candidate deleted.', 'success');
    loadCandidates();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

// ── Reset form to "add" mode ───────────────────────────────
function resetForm() {
  editingId = null;
  form.reset();
  document.getElementById('candidate-id').value = '';
  formTitle.textContent = 'Add Candidate';
  submitBtn.textContent = 'Add Candidate';
  cancelBtn.style.display = 'none';
  closeDuplicateWarning();
  hideMessage();
}

// ── Clear all filters ──────────────────────────────────────
function clearFilters() {
  searchInput.value = '';
  filterResultInput.value = '';
  filterFacilityInput.value = '';
  filterInterviewInput.value = '';
  applyFilters();
}

// ── Utility: show message banner ──────────────────────────
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(hideMessage, 5000);
}

function hideMessage() {
  messageEl.className = 'message hidden';
  messageEl.textContent = '';
}

// ── Utility: escape HTML to prevent XSS ──────────────────
function escape(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
