'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { WalletButton } from '@/components/WalletButton'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import VerifiedIcon from '@mui/icons-material/Verified'
import SearchIcon from '@mui/icons-material/Search'

type Project = Database['public']['Tables']['projects']['Row'] & {
  social_assets: Database['public']['Tables']['social_assets']['Row'][]
}

type FilterType = 'all' | 'verified' | 'unverified'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchProjects()

    // Set up real-time subscription for project updates
    const channel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: 'status=eq.live'
        },
        (payload) => {
          console.log('Project change detected:', payload)
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Refetch all projects to get updated data with social_assets
            fetchProjects()
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted project from state
            setProjects(prev => prev.filter(p => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    applyFilters()
  }, [projects, filter, searchQuery])

  const fetchProjects = async () => {
    try {
      // Add timestamp to force fresh data (bypass cache)
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          social_assets(*)
        `)
        .eq('status', 'live')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      console.log('Fetched live projects:', data?.length || 0)
      setProjects((data as Project[]) || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...projects]

    // Apply verification filter
    if (filter === 'verified') {
      filtered = filtered.filter(project => 
        project.social_assets?.some(asset => asset.verified)
      )
    } else if (filter === 'unverified') {
      filtered = filtered.filter(project => 
        !project.social_assets?.some(asset => asset.verified)
      )
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(project =>
        project.token_name.toLowerCase().includes(query) ||
        project.token_symbol.toLowerCase().includes(query)
      )
    }

    setFilteredProjects(filtered)
  }

  const getVerifiedCount = (project: Project) => {
    return project.social_assets?.filter(asset => asset.verified).length || 0
  }

  const hasVerifiedSocial = (project: Project) => {
    return project.social_assets?.some(asset => asset.verified) || false
  }

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Sticky Header */}
      <header className="sticky top-0 bg-page-bg/95 backdrop-blur-sm border-b border-border-subtle z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <h1 className="font-display text-2xl font-bold text-text-primary cursor-pointer hover:text-accent-primary transition-colors">
                Align
              </h1>
            </Link>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold text-text-primary mb-2">
              Verified Projects
            </h1>
            <p className="font-body text-text-secondary">
              Browse token projects with verified social accounts and transparent teams
            </p>
          </div>
          <button
            onClick={() => {
              setLoading(true)
              fetchProjects()
            }}
            className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors font-body text-sm font-medium"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          {/* Filter Dropdown */}
          <div className="w-full sm:w-48">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="w-full px-4 py-2.5 bg-card-bg border border-border-subtle rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
            >
              <option value="all">All Projects</option>
              <option value="verified">Verified Only</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by token name or symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card-bg border border-border-subtle rounded-lg font-body text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <p className="font-body text-text-secondary">Loading projects...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <p className="font-body text-text-secondary">
              {searchQuery || filter !== 'all'
                ? 'No projects match your filters'
                : 'No projects found'}
            </p>
          </div>
        )}

        {/* Projects Grid */}
        {!loading && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link key={project.id} href={`/project/${project.id}`}>
                <Card 
                  className="p-6 cursor-pointer transition-transform duration-200 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="flex flex-col items-center text-center">
                    {/* Profile Image */}
                    <div className="w-20 h-20 rounded-full bg-accent-primary-soft flex items-center justify-center mb-4 overflow-hidden">
                      {project.profile_image_url ? (
                        <img
                          src={project.profile_image_url}
                          alt={project.token_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-display text-2xl font-bold text-accent-primary">
                          {project.token_symbol.charAt(0)}
                        </span>
                      )}
                    </div>

                    {/* Token Name */}
                    <h3 className="font-display text-lg font-semibold text-text-primary mb-1">
                      {project.token_name}
                    </h3>

                    {/* Token Symbol */}
                    <p className="font-body text-sm text-text-secondary mb-3">
                      ${project.token_symbol}
                    </p>

                    {/* Verification Badge */}
                    {hasVerifiedSocial(project) && (
                      <div className="flex items-center gap-1 mb-3">
                        <VerifiedIcon 
                          className="text-accent-success" 
                          sx={{ fontSize: 20 }}
                        />
                        <span className="font-body text-sm text-accent-success font-medium">
                          Verified
                        </span>
                      </div>
                    )}

                    {/* Verified Socials Count */}
                    <p className="font-body text-sm text-text-muted">
                      {getVerifiedCount(project)} verified account
                      {getVerifiedCount(project) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

