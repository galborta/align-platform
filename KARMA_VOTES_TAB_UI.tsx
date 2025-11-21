// Karma & Votes Tab - Comprehensive Wallet Management UI
// Replace the existing "Karma & Votes Tab" section with this code

{/* Karma & Votes Tab - Comprehensive Management */}
{currentTab === 'karma' && (
  <div className="space-y-6">
    <Alert severity="info">
      <AlertTitle>Karma & Votes Management</AlertTitle>
      Manage wallet karma, view voting activity, adjust points, clear warnings, and ban/unban users.
    </Alert>

    {/* Quick Stats Cards */}
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {(() => {
        const stats = getKarmaStats()
        return (
          <>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-text-muted">Total Wallets</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.totalKarma.toLocaleString()}</p>
              <p className="text-xs text-text-muted">Total Karma</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{Math.round(stats.avgKarma)}</p>
              <p className="text-xs text-text-muted">Avg Karma</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.warned}</p>
              <p className="text-xs text-text-muted">Warned</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.banned}</p>
              <p className="text-xs text-text-muted">Banned</p>
            </Card>
          </>
        )
      })()}
    </div>

    {/* Filters & Search */}
    <Card className="p-4">
      <h3 className="font-display text-sm font-semibold mb-3 text-text-muted uppercase">Filters & Sort</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <FormControl fullWidth size="small">
          <InputLabel>Status</InputLabel>
          <Select
            value={karmaStatusFilter}
            label="Status"
            onChange={(e) => setKarmaStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="warned">Warned</MenuItem>
            <MenuItem value="banned">Banned</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>Sort By</InputLabel>
          <Select
            value={karmaSort}
            label="Sort By"
            onChange={(e) => setKarmaSort(e.target.value)}
          >
            <MenuItem value="karma-desc">Karma (High to Low)</MenuItem>
            <MenuItem value="karma-asc">Karma (Low to High)</MenuItem>
            <MenuItem value="assets-added">Assets Added</MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          size="small"
          label="Search Wallet"
          placeholder="Wallet address..."
          value={karmaWalletSearch}
          onChange={(e) => setKarmaWalletSearch(e.target.value)}
        />

        <MuiButton
          variant="outlined"
          size="small"
          onClick={() => {
            setKarmaStatusFilter('all')
            setKarmaSort('karma-desc')
            setKarmaWalletSearch('')
          }}
        >
          Clear Filters
        </MuiButton>
      </div>
    </Card>

    {/* Bulk Actions */}
    {selectedKarmaWallets.size > 0 && (
      <Card className="p-4 bg-purple-50 border-2 border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Chip label={`${selectedKarmaWallets.size} selected`} color="primary" />
            <MuiButton size="small" onClick={() => setSelectedKarmaWallets(new Set())}>
              Clear Selection
            </MuiButton>
          </div>
          <div className="flex gap-2">
            <MuiButton
              variant="contained"
              size="small"
              onClick={handleBulkAwardKarma}
              disabled={processingKarmaAction}
              sx={{ bgcolor: '#10B981' }}
            >
              Award Karma
            </MuiButton>
            <MuiButton
              variant="contained"
              size="small"
              color="error"
              onClick={() => {
                if (confirm(`Reset karma to 0 for ${selectedKarmaWallets.size} wallets?`)) {
                  // Implement bulk reset
                  toast.error('Bulk reset not yet implemented')
                }
              }}
              disabled={processingKarmaAction}
            >
              Reset to 0
            </MuiButton>
          </div>
        </div>
      </Card>
    )}

    {/* Karma Leaderboard Table */}
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedKarmaWallets.size === filteredKarmaRecords.length && filteredKarmaRecords.length > 0}
                  onChange={() => {
                    if (selectedKarmaWallets.size === filteredKarmaRecords.length) {
                      setSelectedKarmaWallets(new Set())
                    } else {
                      setSelectedKarmaWallets(new Set(filteredKarmaRecords.map(k => k.wallet_address)))
                    }
                  }}
                  className="cursor-pointer"
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rank</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Wallet</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Karma</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Activity</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredKarmaRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-gray-500">
                  No karma records found
                </td>
              </tr>
            ) : (
              filteredKarmaRecords.map((karma, index) => (
                <tr key={karma.wallet_address} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedKarmaWallets.has(karma.wallet_address)}
                      onChange={() => {
                        const newSet = new Set(selectedKarmaWallets)
                        if (newSet.has(karma.wallet_address)) {
                          newSet.delete(karma.wallet_address)
                        } else {
                          newSet.add(karma.wallet_address)
                        }
                        setSelectedKarmaWallets(newSet)
                      }}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-gray-700">#{index + 1}</span>
                      {index === 0 && <span className="text-xl">🥇</span>}
                      {index === 1 && <span className="text-xl">🥈</span>}
                      {index === 2 && <span className="text-xl">🥉</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">{shortenAddress(karma.wallet_address)}</span>
                      <button onClick={() => copyToClipboard(karma.wallet_address)}>
                        <ContentCopyIcon sx={{ fontSize: 12 }} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-bold text-lg">{karma.total_karma_points}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs space-y-1">
                      <div>📝 Assets: {karma.assets_added_count || 0}</div>
                      <div>👍 Upvotes: {karma.upvotes_given_count || 0}</div>
                      <div>👎 Reports: {karma.reports_given_count || 0}</div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      {karma.is_banned && (
                        <Chip label="BANNED" size="small" color="error" sx={{ fontSize: 9 }} />
                      )}
                      {karma.warning_count > 0 && !karma.is_banned && (
                        <Chip 
                          label={`${karma.warning_count} WARNING${karma.warning_count > 1 ? 'S' : ''}`} 
                          size="small" 
                          color="warning"
                          sx={{ fontSize: 9 }}
                        />
                      )}
                      {karma.ban_expires_at && (
                        <p className="text-xs text-red-600">
                          Until {new Date(karma.ban_expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <MuiButton
                        size="small"
                        onClick={() => setViewingKarmaWallet(karma)}
                        title="View Details"
                      >
                        👁️
                      </MuiButton>
                      <MuiButton
                        size="small"
                        onClick={() => setAdjustingKarmaWallet(karma)}
                        title="Adjust Karma"
                      >
                        ±
                      </MuiButton>
                      {karma.warning_count > 0 && (
                        <MuiButton
                          size="small"
                          color="warning"
                          onClick={() => handleClearWarnings(karma)}
                          title="Clear Warnings"
                        >
                          🧹
                        </MuiButton>
                      )}
                      {karma.is_banned ? (
                        <MuiButton
                          size="small"
                          onClick={() => handleUnbanWallet(karma)}
                          sx={{ bgcolor: '#10B981', color: 'white', minWidth: 'auto', px: 1 }}
                          title="Unban"
                        >
                          ✓
                        </MuiButton>
                      ) : (
                        <MuiButton
                          size="small"
                          color="error"
                          onClick={() => setBanningWallet(karma)}
                          title="Ban"
                        >
                          🚫
                        </MuiButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
        Showing {filteredKarmaRecords.length} of {karmaRecords.length} wallets
      </div>
    </Card>

    {/* View Wallet Details Modal */}
    <Dialog open={!!viewingKarmaWallet} onClose={() => setViewingKarmaWallet(null)} maxWidth="md" fullWidth>
      <DialogTitle>Wallet Karma Details</DialogTitle>
      <DialogContent>
        {viewingKarmaWallet && (
          <div className="space-y-4 mt-2">
            {/* Overview */}
            <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50">
              <h4 className="font-semibold text-sm mb-3">Overview</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Total Karma</p>
                  <p className="text-2xl font-bold text-purple-600">{viewingKarmaWallet.total_karma_points}</p>
                </div>
                <div>
                  <p className="text-gray-600">Rank</p>
                  <p className="text-2xl font-bold">#{karmaRecords.findIndex(k => k.wallet_address === viewingKarmaWallet.wallet_address) + 1}</p>
                </div>
              </div>
            </Card>

            {/* Activity Breakdown */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Activity</h4>
              <div className="bg-gray-50 p-3 rounded space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Assets submitted:</span>
                  <span className="font-medium">{viewingKarmaWallet.assets_added_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Upvotes given:</span>
                  <span className="font-medium">{viewingKarmaWallet.upvotes_given_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reports given:</span>
                  <span className="font-medium">{viewingKarmaWallet.reports_given_count || 0}</span>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {viewingKarmaWallet.warning_count > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 text-yellow-600">Warnings ({viewingKarmaWallet.warning_count})</h4>
                {viewingKarmaWallet.warnings && viewingKarmaWallet.warnings.length > 0 ? (
                  <div className="space-y-2">
                    {(viewingKarmaWallet.warnings as any[]).map((warning, idx) => (
                      <div key={idx} className="bg-yellow-50 p-2 rounded text-xs">
                        <p className="font-medium">{warning.reason || 'No reason provided'}</p>
                        <p className="text-gray-600">
                          {warning.timestamp ? new Date(warning.timestamp).toLocaleString() : 'Unknown date'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No warning details available</p>
                )}
              </div>
            )}

            {/* Ban Status */}
            {viewingKarmaWallet.is_banned && (
              <Alert severity="error">
                <AlertTitle>Banned</AlertTitle>
                <p className="text-sm">Banned on: {viewingKarmaWallet.banned_at ? new Date(viewingKarmaWallet.banned_at).toLocaleString() : 'Unknown'}</p>
                {viewingKarmaWallet.ban_expires_at ? (
                  <p className="text-sm">Expires: {new Date(viewingKarmaWallet.ban_expires_at).toLocaleString()}</p>
                ) : (
                  <p className="text-sm">Permanent ban</p>
                )}
              </Alert>
            )}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <MuiButton onClick={() => setViewingKarmaWallet(null)}>Close</MuiButton>
      </DialogActions>
    </Dialog>

    {/* Adjust Karma Modal */}
    <Dialog open={!!adjustingKarmaWallet} onClose={() => setAdjustingKarmaWallet(null)} maxWidth="sm" fullWidth>
      <DialogTitle>Adjust Karma</DialogTitle>
      <DialogContent>
        {adjustingKarmaWallet && (
          <div className="space-y-4 mt-2">
            <Alert severity="info">
              Current karma: <strong>{adjustingKarmaWallet.total_karma_points} points</strong>
            </Alert>

            <div>
              <h4 className="font-semibold text-sm mb-2">Quick Adjustments</h4>
              <div className="grid grid-cols-3 gap-2">
                {[10, 50, 100, -10, -50, -100].map(amount => (
                  <MuiButton
                    key={amount}
                    variant="outlined"
                    size="small"
                    onClick={() => setKarmaAdjustAmount(amount)}
                    color={amount > 0 ? 'success' : 'error'}
                  >
                    {amount > 0 ? '+' : ''}{amount}
                  </MuiButton>
                ))}
              </div>
            </div>

            <TextField
              label="Custom Amount"
              type="number"
              fullWidth
              value={karmaAdjustAmount}
              onChange={(e) => setKarmaAdjustAmount(parseInt(e.target.value) || 0)}
              helperText="Enter positive or negative number"
            />

            <TextField
              label="Reason (required)"
              fullWidth
              multiline
              rows={2}
              value={karmaAdjustReason}
              onChange={(e) => setKarmaAdjustReason(e.target.value)}
              placeholder="Explain why karma is being adjusted..."
            />

            {karmaAdjustAmount !== 0 && (
              <Alert severity={karmaAdjustAmount > 0 ? 'success' : 'warning'}>
                New karma: <strong>{adjustingKarmaWallet.total_karma_points + karmaAdjustAmount} points</strong>
              </Alert>
            )}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <MuiButton onClick={() => {
          setAdjustingKarmaWallet(null)
          setKarmaAdjustAmount(0)
          setKarmaAdjustReason('')
        }}>
          Cancel
        </MuiButton>
        <MuiButton 
          variant="contained" 
          onClick={handleAdjustKarma} 
          disabled={processingKarmaAction || karmaAdjustAmount === 0 || !karmaAdjustReason.trim()}
        >
          {processingKarmaAction ? 'Adjusting...' : 'Apply Adjustment'}
        </MuiButton>
      </DialogActions>
    </Dialog>

    {/* Ban Wallet Modal */}
    <Dialog open={!!banningWallet} onClose={() => setBanningWallet(null)} maxWidth="sm" fullWidth>
      <DialogTitle className="text-red-600">🚫 Ban Wallet</DialogTitle>
      <DialogContent>
        {banningWallet && (
          <div className="space-y-4 mt-2">
            <Alert severity="error">
              <AlertTitle>Ban User</AlertTitle>
              User will not be able to vote or submit assets while banned.
            </Alert>

            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm"><strong>Wallet:</strong> <span className="font-mono text-xs">{banningWallet.wallet_address}</span></p>
              <p className="text-sm"><strong>Current Karma:</strong> {banningWallet.total_karma_points} points</p>
            </div>

            <FormControl fullWidth>
              <InputLabel>Duration</InputLabel>
              <Select
                value={banDuration}
                label="Duration"
                onChange={(e) => setBanDuration(e.target.value as any)}
              >
                <MenuItem value="7d">7 Days</MenuItem>
                <MenuItem value="30d">30 Days</MenuItem>
                <MenuItem value="permanent">Permanent</MenuItem>
              </Select>
            </FormControl>

            {banDuration !== 'permanent' && (
              <Alert severity="info">
                Ban expires: {new Date(calculateBanExpiry(banDuration)!).toLocaleString()}
              </Alert>
            )}

            <TextField
              label="Reason (required)"
              fullWidth
              multiline
              rows={3}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Explain why user is being banned..."
            />
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <MuiButton onClick={() => {
          setBanningWallet(null)
          setBanReason('')
        }}>
          Cancel
        </MuiButton>
        <MuiButton 
          variant="contained" 
          color="error"
          onClick={handleBanWallet} 
          disabled={processingKarmaAction || !banReason.trim()}
        >
          {processingKarmaAction ? 'Banning...' : 'Ban User'}
        </MuiButton>
      </DialogActions>
    </Dialog>
  </div>
)}

