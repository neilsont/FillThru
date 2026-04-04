"use client";

import { useState } from "react";
import { useSearchJobs, useCreateJob } from "@/hooks/use-jobs";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Loader2, Plus, MapPin } from "lucide-react";

interface SearchResult {
  title: string;
  company: string;
  location: string;
  job_type: string;
  description: string;
  url: string;
  match_score?: number;
}

export function JobSearchBar() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchMutation = useSearchJobs();
  const createJob = useCreateJob();
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      const data = await searchMutation.mutateAsync({ query, location });
      setResults(Array.isArray(data) ? data : []);
      setShowResults(true);
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    }
  };

  const handleAdd = async (result: SearchResult) => {
    try {
      await createJob.mutateAsync({
        title: result.title,
        company: result.company,
        location: result.location,
        job_type: result.job_type,
        description: result.description,
        url: result.url,
        source: "indeed",
        match_score: result.match_score,
      });
      toast({ title: "Job added to your board" });
      setResults((prev) => prev.filter((r) => r.url !== result.url));
    } catch {
      toast({ title: "Failed to add job", variant: "destructive" });
    }
  };

  return (
    <div className="relative flex-1">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <div className="relative w-40">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={searchMutation.isPending}
          size="sm"
          variant="accent"
        >
          {searchMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {showResults && results.length > 0 && (
        <Card className="absolute top-full mt-2 left-0 right-0 z-50 max-h-96 overflow-y-auto">
          <CardContent className="p-2 space-y-2">
            {results.map((result, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{result.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.company} &middot; {result.location}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {result.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdd(result)}
                  disabled={createJob.isPending}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              className="w-full text-xs"
              onClick={() => setShowResults(false)}
            >
              Close results
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
