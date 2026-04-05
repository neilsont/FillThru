"use client";

import { useState } from "react";
import { useSearchJobs, useCreateJob } from "@/hooks/use-jobs";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Plus, MapPin, ExternalLink } from "lucide-react";

interface SearchResult {
  title: string;
  company: string;
  location: string;
  job_type: string;
  description: string;
  url: string;
  source?: string;
  match_score?: number;
}

const SOURCE_COLORS: Record<string, string> = {
  Indeed: "bg-blue-100 text-blue-700",
  LinkedIn: "bg-indigo-100 text-indigo-700",
  Glassdoor: "bg-emerald-100 text-emerald-700",
  "Google Jobs": "bg-red-100 text-red-700",
};

export function JobSearchBar() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);
  const searchMutation = useSearchJobs();
  const createJob = useCreateJob();
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setAdded(new Set());
    try {
      const data = await searchMutation.mutateAsync({ query, location });
      setResults(Array.isArray(data) ? data : []);
      setShowResults(true);
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    }
  };

  const handleAdd = async (result: SearchResult) => {
    const key = result.url || `${result.title}-${result.company}`;
    try {
      await createJob.mutateAsync({
        title: result.title,
        company: result.company,
        location: result.location,
        job_type: result.job_type,
        description: result.description,
        url: result.url,
        source: result.source ?? "search",
        match_score: result.match_score,
      });
      setAdded((prev) => new Set([...prev, key]));
      toast({ title: `${result.title} at ${result.company} added to your board` });
    } catch {
      toast({ title: "Failed to add job", variant: "destructive" });
    }
  };

  return (
    <div className="relative flex-1">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Job title, keywords..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <div className="relative w-36 hidden sm:block">
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="pl-8 h-9 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} disabled={searchMutation.isPending} size="sm" variant="accent">
          {searchMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
        </Button>
      </div>

      {showResults && (
        <Card className="absolute top-full mt-2 left-0 right-0 z-50 max-h-[480px] overflow-y-auto shadow-lg border-border/60">
          <CardContent className="p-2 space-y-1">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No results found. Try different keywords.</p>
            ) : (
              results.map((result, i) => {
                const key = result.url || `${result.title}-${result.company}-${i}`;
                const isAdded = added.has(key);
                const sourceColor = SOURCE_COLORS[result.source ?? ""] ?? "bg-slate-100 text-slate-600";
                return (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 p-2.5 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-medium text-sm">{result.title}</p>
                        {result.source && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sourceColor}`}>
                            {result.source}
                          </span>
                        )}
                        {result.match_score && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {result.match_score}% match
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {result.company}
                        {result.location && ` · ${result.location}`}
                        {result.job_type && ` · ${result.job_type}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {result.description}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant={isAdded ? "secondary" : "outline"}
                        onClick={() => !isAdded && handleAdd(result)}
                        disabled={createJob.isPending || isAdded}
                        className="h-7 text-xs"
                      >
                        {isAdded ? "Added ✓" : <><Plus className="h-3 w-3 mr-1" /> Add</>}
                      </Button>
                      {result.url && !result.url.includes("example.com") && (
                        <a href={result.url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" className="h-7 text-xs w-full">
                            <ExternalLink className="h-3 w-3 mr-1" /> View
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div className="pt-1 border-t border-border/40">
              <Button variant="ghost" className="w-full text-xs h-8" onClick={() => setShowResults(false)}>
                Close results
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
