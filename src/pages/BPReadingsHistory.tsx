import React, { useState, useEffect } from 'react';
import { Heart, TrendingUp, TrendingDown, Activity, Clock, BarChart3, Filter, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiService } from '@/lib/api';

interface BPReading {
    id: string;
    deviceId: string;
    timestamp: string;
    type: string;
    patientId: string;
    systolic: number;
    diastolic: number;
    mean: number;
    pulseRate: number;
    unit: string;
}

interface BPStats {
    totalReadings: number;
    averageSystolic: number;
    averageDiastolic: number;
    averagePulse: number;
    highestSystolic: number;
    lowestSystolic: number;
    highestDiastolic: number;
    lowestDiastolic: number;
    normalReadings: number;
    elevatedReadings: number;
    stage1Readings: number;
    stage2Readings: number;
    crisisReadings: number;
}

const BPReadingsHistory: React.FC = () => {
    const [readings, setReadings] = useState<BPReading[]>([]);
    const [stats, setStats] = useState<BPStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadBPReadings();
    }, []);

    const loadBPReadings = async () => {
        try {
            setLoading(true);
            const response = await apiService.getBPHistory('bp-monitor-001');
            setReadings(response.measurements || []);
            calculateStats(response.measurements || []);
        } catch (error) {
            console.error('Failed to load BP readings:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data: BPReading[]) => {
        if (data.length === 0) return;

        const systolicValues = data.map(r => r.systolic);
        const diastolicValues = data.map(r => r.diastolic);
        const pulseValues = data.map(r => r.pulseRate);

        let normalCount = 0, elevatedCount = 0, stage1Count = 0, stage2Count = 0, crisisCount = 0;

        data.forEach(reading => {
            const category = classifyBP(reading.systolic, reading.diastolic);
            switch (category) {
                case 'Normal': normalCount++; break;
                case 'Elevated': elevatedCount++; break;
                case 'Stage 1': stage1Count++; break;
                case 'Stage 2': stage2Count++; break;
                case 'Crisis': crisisCount++; break;
            }
        });

        setStats({
            totalReadings: data.length,
            averageSystolic: Math.round(systolicValues.reduce((a, b) => a + b, 0) / data.length),
            averageDiastolic: Math.round(diastolicValues.reduce((a, b) => a + b, 0) / data.length),
            averagePulse: Math.round(pulseValues.reduce((a, b) => a + b, 0) / data.length),
            highestSystolic: Math.max(...systolicValues),
            lowestSystolic: Math.min(...systolicValues),
            highestDiastolic: Math.max(...diastolicValues),
            lowestDiastolic: Math.min(...diastolicValues),
            normalReadings: normalCount,
            elevatedReadings: elevatedCount,
            stage1Readings: stage1Count,
            stage2Readings: stage2Count,
            crisisReadings: crisisCount
        });
    };

    const classifyBP = (systolic: number, diastolic: number): string => {
        if (systolic < 120 && diastolic < 80) return 'Normal';
        if (systolic >= 120 && systolic <= 129 && diastolic < 80) return 'Elevated';
        if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) return 'Stage 1';
        if (systolic >= 140 || diastolic >= 90) return 'Stage 2';
        if (systolic > 180 || diastolic > 120) return 'Crisis';
        return 'Normal';
    };

    const getBPCategoryColor = (systolic: number, diastolic: number): string => {
        const category = classifyBP(systolic, diastolic);
        switch (category) {
            case 'Normal': return 'bg-green-500/20 text-green-400';
            case 'Elevated': return 'bg-yellow-500/20 text-yellow-400';
            case 'Stage 1': return 'bg-orange-500/20 text-orange-400';
            case 'Stage 2': return 'bg-red-500/20 text-red-400';
            case 'Crisis': return 'bg-red-600/20 text-red-300';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleString();
    };

    const filteredReadings = readings.filter(reading => {
        const matchesSearch = reading.systolic.toString().includes(searchTerm) ||
                            reading.diastolic.toString().includes(searchTerm) ||
                            reading.pulseRate.toString().includes(searchTerm);
        
        if (filter === 'all') return matchesSearch;
        
        const category = classifyBP(reading.systolic, reading.diastolic);
        return category.toLowerCase().includes(filter.toLowerCase()) && matchesSearch;
    });

    const exportToCSV = () => {
        const headers = ['Timestamp', 'Systolic', 'Diastolic', 'Mean', 'Pulse Rate', 'Category'];
        const csvContent = [
            headers.join(','),
            ...filteredReadings.map(reading => [
                formatTimestamp(reading.timestamp),
                reading.systolic,
                reading.diastolic,
                reading.mean,
                reading.pulseRate,
                classifyBP(reading.systolic, reading.diastolic)
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bp-readings-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">BP Readings History</h1>
                    <p className="text-gray-400">Complete blood pressure monitoring data from your device</p>
                </div>
                <Button onClick={exportToCSV} className="bg-blue-600 hover:bg-blue-700">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                </Button>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Total Readings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{stats.totalReadings}</div>
                            <p className="text-xs text-gray-400">All time</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Average BP</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{stats.averageSystolic}/{stats.averageDiastolic}</div>
                            <p className="text-xs text-gray-400">mmHg</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Average Pulse</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{stats.averagePulse}</div>
                            <p className="text-xs text-gray-400">BPM</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">BP Range</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold text-white">
                                {stats.highestSystolic}/{stats.highestDiastolic} - {stats.lowestSystolic}/{stats.lowestDiastolic}
                            </div>
                            <p className="text-xs text-gray-400">High - Low</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* BP Classification Chart */}
            {stats && (
                <Card className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            BP Classification Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-400">{stats.normalReadings}</div>
                                <div className="text-sm text-gray-400">Normal</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-yellow-400">{stats.elevatedReadings}</div>
                                <div className="text-sm text-gray-400">Elevated</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-orange-400">{stats.stage1Readings}</div>
                                <div className="text-sm text-gray-400">Stage 1</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-red-400">{stats.stage2Readings}</div>
                                <div className="text-sm text-gray-400">Stage 2</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-red-300">{stats.crisisReadings}</div>
                                <div className="text-sm text-gray-400">Crisis</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filter & Search
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Search by BP values or pulse rate..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-700 border-gray-600 text-white"
                            />
                        </div>
                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="w-full md:w-48 bg-gray-700 border-gray-600 text-white">
                                <SelectValue placeholder="Filter by category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Readings</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="elevated">Elevated</SelectItem>
                                <SelectItem value="stage 1">Stage 1</SelectItem>
                                <SelectItem value="stage 2">Stage 2</SelectItem>
                                <SelectItem value="crisis">Crisis</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Readings Table */}
            <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        All BP Readings ({filteredReadings.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-gray-700">
                                    <TableHead className="text-gray-300">Timestamp</TableHead>
                                    <TableHead className="text-gray-300">Systolic</TableHead>
                                    <TableHead className="text-gray-300">Diastolic</TableHead>
                                    <TableHead className="text-gray-300">Mean</TableHead>
                                    <TableHead className="text-gray-300">Pulse Rate</TableHead>
                                    <TableHead className="text-gray-300">Category</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredReadings.map((reading) => (
                                    <TableRow key={reading.id} className="border-gray-700 hover:bg-gray-700/50">
                                        <TableCell className="text-gray-300">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-gray-400" />
                                                {formatTimestamp(reading.timestamp)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-white font-semibold">
                                            {reading.systolic} mmHg
                                        </TableCell>
                                        <TableCell className="text-white font-semibold">
                                            {reading.diastolic} mmHg
                                        </TableCell>
                                        <TableCell className="text-gray-300">
                                            {reading.mean} mmHg
                                        </TableCell>
                                        <TableCell className="text-gray-300">
                                            <div className="flex items-center gap-2">
                                                <Heart className="h-4 w-4 text-red-400" />
                                                {reading.pulseRate} BPM
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getBPCategoryColor(reading.systolic, reading.diastolic)}>
                                                {classifyBP(reading.systolic, reading.diastolic)}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    
                    {filteredReadings.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                            No readings found matching your criteria.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default BPReadingsHistory; 