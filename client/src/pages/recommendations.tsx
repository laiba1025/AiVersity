import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useRecommendations } from '@/hooks/use-recommendations';

const RecommendationsPage: React.FC = () => {
  const {
    program, setProgram,
    maxCredits, setMaxCredits,
    preferElectives, setPreferElectives,
    run, isLoading, error, results
  } = useRecommendations();

  const [programs, setPrograms] = useState<string[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);

  // Fetch available programs
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const response = await fetch('/api/programs');
        const data = await response.json();
        if (data.programs && data.programs.length > 0) {
          setPrograms(data.programs);
          setProgram(data.programs[0]);
        }
      } catch (err) {
        console.error('Failed to load programs:', err);
        // Fallback to default programs
        setPrograms(['AI MSc', 'CS BSc', 'Data Science MSc', 'Engineering BSc', 'Cybersecurity MSc']);
      } finally {
        setLoadingPrograms(false);
      }
    };
    fetchPrograms();
  }, [setProgram]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await run();
  };

  const creditsUsed = results.totalCredits;
  const creditsPercent = Math.round((creditsUsed / maxCredits) * 100);

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Course Recommendations</h1>
        <p className="text-muted-foreground mt-2">
          Get personalized course recommendations based on your program and preferences
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendation Filters</CardTitle>
          <CardDescription>Configure your preferences to get tailored recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Program Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">Program</label>
                <select
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  disabled={loadingPrograms}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:bg-neutral-100"
                >
                  {loadingPrograms ? (
                    <option>Loading programs...</option>
                  ) : (
                    programs.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Max Credits */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">Maximum Credits per Semester</label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={maxCredits}
                  onChange={(e) => setMaxCredits(parseInt(e.target.value || '0', 10))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Preferences Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="preferElectives"
                checked={preferElectives}
                onCheckedChange={(checked) => setPreferElectives(checked as boolean)}
              />
              <label htmlFor="preferElectives" className="cursor-pointer text-sm font-medium">
                I prefer elective courses
              </label>
            </div>

            {/* Submit Button */}
            <Button type="submit" disabled={isLoading || loadingPrograms} size="lg" className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Fetching Recommendations...' : 'Get Recommendations'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700 text-sm font-medium">{error instanceof Error ? error.message : 'An error occurred'}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.recommendations.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-neutral-600">Total Courses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{results.recommendations.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-neutral-600">Total Credits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {creditsUsed} / {maxCredits}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-neutral-600">Credit Utilization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold">{creditsPercent}%</p>
                  <div className="w-full bg-neutral-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${Math.min(creditsPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Courses Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Courses for {program}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead className="text-center">Type</TableHead>
                      <TableHead className="text-center">Semester</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.recommendations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono font-semibold">{r.code}</TableCell>
                        <TableCell className="max-w-xs">{r.title}</TableCell>
                        <TableCell className="text-right font-semibold">{r.credits}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            {r.required && (
                              <Badge variant="default" className="bg-blue-600">
                                Required
                              </Badge>
                            )}
                            {r.elective && (
                              <Badge variant="outline" className="border-purple-600 text-purple-600">
                                Elective
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {r.semester ? (
                            <Badge variant="secondary">Sem {r.semester}</Badge>
                          ) : (
                            <span className="text-neutral-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-neutral-600 max-w-xs">
                          {r.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {results.recommendations.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-neutral-500 text-sm">No recommendations yet. Fill in the filters and click "Get Recommendations" to get started!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RecommendationsPage;
