import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSearch } from '@/hooks/use-search';

const SearchPage: React.FC = () => {
  const { query, setQuery, results, isLoading, search } = useSearch();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search();
  };

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white p-4 rounded-lg border border-neutral-200">
        <form onSubmit={onSubmit} className="flex items-center space-x-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
              <span className="material-icons">search</span>
            </span>
            <Input
              type="text"
              placeholder="Search policies, guides, or faculty contacts"
              className="w-full pl-10 pr-4 py-2"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit" className="bg-primary text-white">
            Search
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <span className="material-icons animate-spin mr-2">autorenew</span>
          <span>Searching…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h2 className="text-lg font-semibold mb-2">Policies & Guides</h2>
            {results.policies.length === 0 ? (
              <p className="text-neutral-500 text-sm">No results</p>
            ) : (
              <div className="space-y-3">
                {results.policies.map((r, idx) => (
                  <Card key={idx}>
                    <CardContent className="pt-4">
                      <p className="text-sm whitespace-pre-wrap">{r.snippet}</p>
                      <div className="text-xs text-neutral-500 mt-2">
                        {r.source && <span>Source: {r.source}</span>}
                        {typeof r.page === 'number' && <span className="ml-2">Page: {r.page}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Faculty Contacts</h2>
            {results.contacts.length === 0 ? (
              <p className="text-neutral-500 text-sm">No contacts</p>
            ) : (
              <div className="space-y-3">
                {results.contacts.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{c.name}</h3>
                          <p className="text-sm text-neutral-600">{c.role} • {c.department}</p>
                          <div className="text-sm mt-2 space-y-1">
                            <p>Email: <a className="text-primary" href={`mailto:${c.email}`}>{c.email}</a></p>
                            {c.phone && <p>Phone: <a className="text-primary" href={`tel:${c.phone}`}>{c.phone}</a></p>}
                            {c.office && <p>Office: {c.office}</p>}
                            {c.officeHours && <p>Hours: {c.officeHours}</p>}
                          </div>
                        </div>
                        <div className="text-xs text-neutral-500">
                          {c.tags && c.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 justify-end">
                              {c.tags.map((t, i) => (
                                <span key={i} className="px-2 py-1 bg-neutral-100 rounded-full">{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
