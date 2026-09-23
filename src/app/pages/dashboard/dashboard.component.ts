import { Component, inject } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';

import { NexusApiService } from '../../core/nexus-api.service';
import {
  NexusDecision,
  NexusEvent,
} from '../../core/nexus.models';

interface DashboardLog {
  time: string;
  agent: 'OOS_AGENT' | 'CRM_AGENT' | 'SWAP_AGENT';
  message: string;
  orderReference: string;
  customer: string;
  action: string;
  type?: string;
  incidentId?: string;
  decision?: NexusDecision;
}
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatIconModule,
    MatDividerModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {

  private readonly nexusApi = inject(NexusApiService);

  isSimulating = false;
  activeIncidentId: string | null = null;

  selectedAgent = 'ALL';

  logs: DashboardLog[] = [
    {
      time: '09:14:02',
      agent: 'OOS_AGENT',
      message:
        'Canceled Shopee Order #1234 → Taguig Hub Stock Available → Viber Offer Sent',
      orderReference: '2026093A9R2P04X (Shopee #1234)',
      customer: 'Maria Santos',
      action:
        'Triggered out-of-stock recovery workflow and customer outreach',
    },

    {
      time: '09:14:15',
      agent: 'CRM_AGENT',
      message:
        'Suppression Active on Customer: Maria Santos (ID: 9812)',
      orderReference: 'CRM-9812',
      customer: 'Maria Santos',
      action:
        'Customer suppression guardrail activated',
    },

    {
      time: '09:14:48',
      agent: 'SWAP_AGENT',
      message:
        'Option B Selected → GCash B2B Disbursement Executed (PHP 2,500) → Voucher Issued',
      orderReference: 'SWAP-2500-PHP',
      customer: 'Maria Santos',
      action:
        'GCash liquidity swap executed and recovery voucher generated',
    },

    {
      time: '09:15:10',
      agent: 'SWAP_AGENT',
      message:
        'Viber Delivery Receipt Confirmed → Customer Maria Santos opened Recovery Voucher',
      orderReference: 'VBR-9812',
      customer: 'Maria Santos',
      action:
        'Recovery voucher delivery confirmed',
    },

    {
      time: '09:16:22',
      agent: 'OOS_AGENT',
      message:
        'Shopee Order #1239 Canceled by Platform → Taguig Hub Batch Allocation Reserved → WhatsApp Sent',
      orderReference: '2026093A9R2P11X (Shopee #1239)',
      customer: 'Maria Santos',
      action:
        'Stockout recovery workflow initiated and alternate fulfillment reserved',
    },

    {
      time: '09:17:05',
      agent: 'SWAP_AGENT',
      message:
        'Option A Selected → Lalamove API Express Dispatch Booked → Rider Assigned (LLM-8912)',
      orderReference: 'LLM-8912',
      customer: 'Maria Santos',
      action:
        'Express delivery dispatch booked and rider assigned',
    },
  ];

  selectedLog: DashboardLog = this.logs[0];

  get filteredLogs() {
    if (this.selectedAgent === 'ALL') {
      return this.logs;
    }

    return this.logs.filter(
      (log) => log.agent === this.selectedAgent
    );
  }

  selectLog(log: DashboardLog) {
    this.selectedLog = log;
  }

  simulateLiveIncident() {
    if (this.isSimulating) {
      return;
    }

    this.isSimulating = true;

    this.nexusApi.simulateIncident().subscribe({
      next: ({ incidentId }) => {
        this.activeIncidentId = incidentId;

        this.nexusApi.connectToIncidentEvents(incidentId).subscribe({
          next: (event) => this.handleNexusEvent(event),

          error: (error) => {
            console.error('NexusCX SSE error:', error);
            this.isSimulating = false;
          },

          complete: () => {
            this.isSimulating = false;
          },
        });
      },

      error: (error) => {
        console.error('Failed to simulate NexusCX incident:', error);
        this.isSimulating = false;
      },
    });
  }

  private handleNexusEvent(event: NexusEvent) {
    const log: DashboardLog = {
      time: this.formatEventTime(event.timestamp),
      agent: 'OOS_AGENT',
      message: event.message,
      orderReference: `Incident ${event.incidentId}`,
      customer: 'Shopee Customer',
      action: this.getEventAction(event),
      type: event.type,
      incidentId: event.incidentId,
      decision: event.type === 'DECISION_MADE'
        ? event.data
        : undefined,
    };

    this.logs = [log, ...this.logs];
    this.selectedLog = log;
  }

  private formatEventTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }
   
  private getEventAction(event: NexusEvent): string {
    switch (event.type) {
      case 'INCIDENT_RECEIVED':
        return 'NexusCX received the stockout incident';

      case 'INVENTORY_CHECK':
        return 'Checked seller and alternate inventory';

      case 'INVENTORY_FOUND':
        return 'Verified alternate fulfillment inventory';

      case 'DECISION_MADE':
        return 'NexusCX selected the recovery strategy';

      case 'INVENTORY_RESERVED':
        return 'Reserved alternate inventory';

      case 'VIBER_OFFER_SENT':
        return 'Recovery offer sent through Viber';

      case 'INCIDENT_RECOVERED':
        return 'Incident successfully recovered';

      default:
        return event.message;
    }
  }

  resolutionDistribution = [
  {
    option: 'Option B',
    title: 'Instant GCash Refund + ₱500 Voucher',
    percentage: 68,
    orders: 127,
    description:
      'Preferred by shoppers seeking liquidity with conversion-sensitive direct store credit.',
  },
  {
    option: 'Option A',
    title: 'Taguig Hub Same-Day Express Delivery',
    percentage: 32,
    orders: 60,
    description:
      'Preferred by loyal customers who want the skincare set delivered today without reordering friction.',
  },
];

webhookHealth = [
  {
    name: 'Shopee Open Platform API',
    status: 'Healthy',
    detail: 'Latency: 42ms',
    meta: 'Auto-Cancel Hook',
  },
  {
    name: 'GCash Enterprise Disbursement API',
    status: 'Healthy',
    detail: 'Latency: 118ms',
    meta: 'Ref: 0002-CORP',
  },
  {
    name: 'Viber Business Messaging Gateway',
    status: 'Healthy',
    detail: 'Delivery: 99.4%',
    meta: 'VIP Recovery Bot',
  },
  {
    name: 'Klaviyo / Braze CRM Webhook',
    status: 'Healthy',
    detail: 'Audience Shield',
    meta: 'Instant Mute',
  },
];
}