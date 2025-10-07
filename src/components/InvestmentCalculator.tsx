import { useState, useEffect } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    Title, Tooltip, Legend, Filler, ArcElement
} from 'chart.js';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from './theme-toggle';
import lzString from 'lz-string';
import { Settings, Share2 } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, ArcElement);

// --- TIPAGEM ---
type Scenario = 'pessimistic' | 'realistic' | 'optimistic';
type Granularity = 'monthly' | 'bimonthly' | 'quarterly' | 'semiannually' | 'yearly';

interface SimulationResult {
    compositionData: Record<Scenario, any>;
    donutData: Record<Scenario, any>;
    summaries: Record<Scenario, ScenarioSummary>;
}

interface ScenarioSummary {
    finalAmount: number;
    totalInvested: number;
    totalInterest: number;
    tax: number;
    netAmount: number;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const compositionOptions = {
    plugins: { legend: { reverse: true } },
    scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: (v: any) => currencyFormatter.format(v) } } },
    interaction: { mode: 'index' as const, intersect: false },
    maintainAspectRatio: false,
};

// --- COMPONENTE PRINCIPAL ---
const InvestmentCalculator = () => {
    // --- ESTADOS ---
    const [mode, setMode] = useState<'futureValue' | 'monthlyPayment'>('futureValue');
    const [initialValue, setInitialValue] = useState(1000);
    const [monthlyContribution, setMonthlyContribution] = useState(500);
    const [period, setPeriod] = useState(10);
    const [periodType, setPeriodType] = useState<'years' | 'months'>('years');
    const [realisticRate, setRealisticRate] = useState(1);
    const [optimisticRate, setOptimisticRate] = useState(1.2);
    const [pessimisticRate, setPessimisticRate] = useState(0.8);
    const [financialGoal, setFinancialGoal] = useState(1000000);
    const [calculatedPmt, setCalculatedPmt] = useState<number | null>(null);
    const [result, setResult] = useState<SimulationResult | null>(null);
    const [activeTab, setActiveTab] = useState<Scenario>('realistic');
    const [granularity, setGranularity] = useState<Granularity>('yearly');

    // --- FUNÇÕES ---

    useEffect(() => {
        try {
            const hash = window.location.hash.slice(1);
            if (hash) {
                const decompressed = lzString.decompressFromEncodedURIComponent(hash);
                if (!decompressed) return;
                const params = JSON.parse(decompressed);
                setInitialValue(params.iv || 1000);
                setMonthlyContribution(params.mc || 500);
                setPeriod(params.p || 10);
                setPeriodType(params.pt || 'years');
                setRealisticRate(params.rr || 1);
                setOptimisticRate(params.or || 1.2);
                setPessimisticRate(params.pr || 0.8);
            }
        } catch (error) { console.error("Falha ao carregar dados da URL:", error); }
    }, []);

    const handleSimulation = () => {
        const totalMonths = periodType === 'years' ? period * 12 : period;
        if (totalMonths <= 0) {
            alert("O prazo do investimento deve ser maior que zero.");
            return;
        }

        const rates = { realistic: realisticRate, optimistic: optimisticRate, pessimistic: pessimisticRate };
        const summaries: Partial<Record<Scenario, ScenarioSummary>> = {};
        const compositionData: Partial<Record<Scenario, any>> = {};
        const donutData: Partial<Record<Scenario, any>> = {};

        (['realistic', 'optimistic', 'pessimistic'] as Scenario[]).forEach(scenario => {
            const rate = rates[scenario];
            const labels = Array.from({ length: totalMonths + 1 }, (_, i) => `${i}`);
            const initialValueSeries = Array(totalMonths + 1).fill(initialValue);
            const contributionsSeries = [0];
            const interestSeries = [0];
            let currentTotal = initialValue;
            let totalContributions = 0;
            
            for (let i = 1; i <= totalMonths; i++) {
                currentTotal = (currentTotal + monthlyContribution) * (1 + rate / 100);
                totalContributions += monthlyContribution;
                const totalInterest = currentTotal - initialValue - totalContributions;
                contributionsSeries.push(totalContributions);
                interestSeries.push(parseFloat(totalInterest.toFixed(2)));
            }
            
            compositionData[scenario] = {
                labels,
                datasets: [
                    { label: 'Juros', data: interestSeries, backgroundColor: 'rgba(75, 192, 192, 0.6)', fill: true },
                    { label: 'Aportes', data: contributionsSeries, backgroundColor: 'rgba(54, 162, 235, 0.6)', fill: true },
                    { label: 'Valor Inicial', data: initialValueSeries, backgroundColor: 'rgba(255, 206, 86, 0.6)', fill: true },
                ]
            };

            const totalInvested = initialValue + totalContributions;
            const totalInterest = currentTotal - totalInvested;
            const tax = totalInterest > 0 ? simulateIncomeTax(totalInterest, totalMonths) : 0;
            summaries[scenario] = { finalAmount: currentTotal, totalInvested, totalInterest, tax, netAmount: currentTotal - tax };
            donutData[scenario] = {
                labels: ['Total Investido', 'Total em Juros'],
                datasets: [{ data: [totalInvested, totalInterest], backgroundColor: ['rgb(54, 162, 235)', 'rgb(75, 192, 192)'] }]
            };
        });

        setResult({
            compositionData: compositionData as Record<Scenario, any>,
            donutData: donutData as Record<Scenario, any>,
            summaries: summaries as Record<Scenario, ScenarioSummary>
        });

        const paramsToSave = { iv: initialValue, mc: monthlyContribution, p: period, pt: periodType, rr: realisticRate, or: optimisticRate, pr: pessimisticRate };
        window.location.hash = lzString.compressToEncodedURIComponent(JSON.stringify(paramsToSave));
    };

    const handleReverseCalculation = () => {
        const totalMonths = periodType === 'years' ? period * 12 : period;
        const rate = realisticRate / 100;

        if (totalMonths <= 0) {
            alert("O prazo do investimento deve ser maior que zero.");
            setCalculatedPmt(null);
            return;
        }
        if (rate <= 0) {
            alert("A taxa de juros deve ser maior que zero para este cálculo.");
            setCalculatedPmt(null);
            return;
        }

        const futureValue = financialGoal;
        const presentValue = initialValue;
        
        if (presentValue * Math.pow(1 + rate, totalMonths) >= futureValue) {
            setCalculatedPmt(0);
            return;
        }

        const ratePlusOne = 1 + rate;
        const ratePowered = Math.pow(ratePlusOne, totalMonths);
        const pmt = (futureValue - presentValue * ratePowered) / ((ratePowered - 1) / rate);

        setCalculatedPmt(pmt > 0 ? pmt : 0);
    };

    const simulateIncomeTax = (profit: number, months: number): number => {
        const days = months * 30;
        if (days <= 180) return profit * 0.225;
        if (days <= 360) return profit * 0.20;
        if (days <= 720) return profit * 0.175;
        return profit * 0.15;
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        alert("Link da simulação copiado para a área de transferência!");
    };

    const getChartDataByGranularity = () => {
        if (!result) return null;

        const originalData = result.compositionData[activeTab];
        if (!originalData) return null;
    
        const stepMap: Record<Granularity, { step: number; label: (i: number) => string }> = {
            monthly: { step: 1, label: i => `Mês ${i}` },
            bimonthly: { step: 2, label: i => `Bimestre ${Math.ceil(i/2)}` },
            quarterly: { step: 3, label: i => `Trimestre ${Math.ceil(i/3)}` },
            semiannually: { step: 6, label: i => `Semestre ${Math.ceil(i/6)}` },
            yearly: { step: 12, label: i => `Ano ${Math.ceil(i/12)}` },
        };
    
        const { step, label } = stepMap[granularity];
        const originalLabels = originalData.labels;
        const lastIndex = originalLabels.length - 1;
    
        const filteredDatasets = originalData.datasets.map((dataset: any) => ({
            ...dataset,
            data: dataset.data.filter((_: any, index: number) => index % step === 0 || index === 0 || index === lastIndex),
        }));
    
        const filteredLabels = originalLabels
            .map((monthIndex: string, index: number) => (index === 0 ? 'Início' : label(parseInt(monthIndex, 10))))
            .filter((_: any, index: number) => index % step === 0 || index === 0 || index === lastIndex);
            
        if (lastIndex % step !== 0 && lastIndex > 0) {
            filteredLabels[filteredLabels.length - 1] = label(parseInt(originalLabels[lastIndex], 10));
        }

        return {
            labels: filteredLabels,
            datasets: filteredDatasets,
        };
    };

    const displayChartData = getChartDataByGranularity();

    // --- RENDERIZAÇÃO ---
    return (
        <div className="container mx-auto p-4 md:p-8">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold">Planejador de Investimentos</h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handleShare} title="Copiar link da simulação"><Share2 className="h-4 w-4" /></Button>
                    <ThemeToggle />
                </div>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <RadioGroup defaultValue="futureValue" onValueChange={(v: any) => setMode(v)} className="grid grid-cols-2 gap-4">
                                <div><RadioGroupItem value="futureValue" id="futureValue" className="peer sr-only" /><Label htmlFor="futureValue" className="block text-center p-3 border rounded-lg cursor-pointer peer-data-[state=checked]:border-primary">Calcular Valor Futuro</Label></div>
                                <div><RadioGroupItem value="monthlyPayment" id="monthlyPayment" className="peer sr-only" /><Label htmlFor="monthlyPayment" className="block text-center p-3 border rounded-lg cursor-pointer peer-data-[state=checked]:border-primary">Atingir Objetivo</Label></div>
                            </RadioGroup>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {mode === 'futureValue' ? (<>
                                <div><Label htmlFor="initialValue">Valor Inicial (R$)</Label><Input id="initialValue" type="number" value={initialValue} onChange={(e) => setInitialValue(parseFloat(e.target.value) || 0)} /></div>
                                <div><Label htmlFor="monthlyContribution">Aporte Mensal (R$)</Label><Input id="monthlyContribution" type="number" value={monthlyContribution} onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)} /></div>
                            </>) : (<>
                                <div><Label htmlFor="initialValue">Valor Inicial (R$)</Label><Input id="initialValue" type="number" value={initialValue} onChange={(e) => setInitialValue(parseFloat(e.target.value) || 0)} /></div>
                                <div><Label htmlFor="financialGoal">Objetivo Financeiro (R$)</Label><Input id="financialGoal" type="number" value={financialGoal} onChange={(e) => setFinancialGoal(parseFloat(e.target.value) || 0)} /></div>
                            </>)}
                            <div><Label>Prazo do Investimento</Label><div className="flex items-center gap-4 mt-2"><Input id="period" type="number" value={period} onChange={(e) => setPeriod(parseInt(e.target.value) || 0)} className="w-2/3"/><RadioGroup value={periodType} onValueChange={(v: any) => setPeriodType(v)} className="flex"><div className="flex items-center space-x-2"><RadioGroupItem value="years" id="r-years" /><Label htmlFor="r-years">Anos</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="months" id="r-months" /><Label htmlFor="r-months">Meses</Label></div></RadioGroup></div></div>
                            <div><Label htmlFor="realisticRate">Taxa de Juros Mensal (Realista %)</Label><Input id="realisticRate" type="number" step="0.1" value={realisticRate} onChange={(e) => setRealisticRate(parseFloat(e.target.value) || 0)} /></div>
                            <Button onClick={mode === 'futureValue' ? handleSimulation : handleReverseCalculation} className="w-full">{mode === 'futureValue' ? 'Simular Cenários' : 'Calcular Aporte'}</Button>
                            {mode === 'monthlyPayment' && calculatedPmt !== null && (
                                <div className="text-center p-4 border-dashed border-2 rounded-lg mt-4">
                                    <p>Para atingir seu objetivo, você precisa investir:</p>
                                    <p className="text-2xl font-bold text-primary">{currencyFormatter.format(calculatedPmt)} / mês</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <Card className="min-h-full">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Resultados da Simulação</CardTitle>
                                <CardDescription>Analise os diferentes cenários e a composição do patrimônio.</CardDescription>
                            </div>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="icon" title="Configurar Cenários"><Settings className="h-4 w-4" /></Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Configurar Cenários</DialogTitle></DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div><Label htmlFor="optimisticRate">Taxa Mensal Otimista (%)</Label><Input id="optimisticRate" type="number" step="0.1" value={optimisticRate} onChange={(e) => setOptimisticRate(parseFloat(e.target.value) || 0)} /></div>
                                        <div><Label htmlFor="pessimisticRate">Taxa Mensal Pessimista (%)</Label><Input id="pessimisticRate" type="number" step="0.1" value={pessimisticRate} onChange={(e) => setPessimisticRate(parseFloat(e.target.value) || 0)} /></div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            {!result ? <div className="flex items-center justify-center h-96"><p className="text-gray-500">Aguardando simulação...</p></div> :
                            (<>
                                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Scenario)} className="w-full">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="pessimistic">Pessimista</TabsTrigger>
                                        <TabsTrigger value="realistic">Realista</TabsTrigger>
                                        <TabsTrigger value="optimistic">Otimista</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <div className="mt-4">
                                    {Object.entries(result.summaries).map(([scenario, summary]) => (
                                        activeTab === scenario && (
                                            <Card key={scenario}><CardHeader><CardTitle className="capitalize">Resumo {scenario}</CardTitle></CardHeader>
                                                <CardContent className="space-y-2 text-sm">
                                                    <p>Total Final Bruto:<span className="font-bold float-right">{currencyFormatter.format(summary.finalAmount)}</span></p>
                                                    <p>Total de Juros:<span className="font-bold float-right">{currencyFormatter.format(summary.totalInterest)}</span></p>
                                                    <p>Imposto Estimado:<span className="font-bold float-right text-red-500">{currencyFormatter.format(summary.tax)}</span></p>
                                                    <p className="text-base">Total Líquido:<span className="font-bold text-base float-right text-green-500">{currencyFormatter.format(summary.netAmount)}</span></p>
                                                </CardContent>
                                            </Card>
                                        )
                                    ))}
                                </div>
                                <div className="mt-8">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                                        <h3 className="font-semibold capitalize">Gráfico de Composição ({activeTab})</h3>
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="granularity" className="text-sm text-muted-foreground">Ver por:</Label>
                                            <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
                                                <SelectTrigger id="granularity" className="w-[120px]">
                                                    <SelectValue placeholder="Granularidade" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="monthly">Mensal</SelectItem>
                                                    <SelectItem value="bimonthly">Bimestral</SelectItem>
                                                    <SelectItem value="quarterly">Trimestral</SelectItem>
                                                    <SelectItem value="semiannually">Semestral</SelectItem>
                                                    <SelectItem value="yearly">Anual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                                        <div className="md:col-span-2 h-64 sm:h-80">
                                            {displayChartData && <Line data={displayChartData} options={compositionOptions} />}
                                        </div>
                                        <div className="flex flex-col items-center justify-center">
                                            <h3 className="font-semibold mb-2 capitalize">Composição Final ({activeTab})</h3>
                                            <Doughnut data={result.donutData[activeTab]} />
                                        </div>
                                    </div>
                                </div>
                            </>)}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
export default InvestmentCalculator;