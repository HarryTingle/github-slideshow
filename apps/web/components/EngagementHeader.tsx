'use client';

import {
  capacityBasis,
  formatDays,
  setClient,
  setEngagementName,
  setPaymentTerms,
  setSprintWeeks,
  setStartDate,
  setWeeks,
  type Engagement,
} from '@scope/engine';
import { useState } from 'react';
import { useModel } from '@/lib/store';

/**
 * Who this is for, and when it runs.
 *
 * The first thing a Head of Consulting does is name the thing and say who it is for, and
 * until now there was nowhere to do either — the engagement was permanently called
 * whatever the seed called it. It sits at the top of the delivery plan because that is
 * where the work starts, and it doubles as the setup row so there is no separate
 * settings page to go and find.
 *
 * The rarely-touched settings — sprint length, payment terms, working week — are folded
 * away. They are assumptions, not decisions, and a bid team changes them once a year.
 */
export function EngagementHeader() {
  const { stressed, update, readOnly } = useModel();
  const [showSettings, setShowSettings] = useState(false);
  const basis = capacityBasis(stressed);

  const field = (
    mutate: (draft: Engagement, value: string) => Engagement,
    label: string,
    key: string,
  ) => ({
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      update((draft) => mutate(draft, event.target.value), { label, coalesce: key }),
  });

  return (
    <div className="engagement-head">
      <div className="identity">
        <input
          className="title-input"
          aria-label="Engagement name"
          placeholder="Name this engagement"
          value={stressed.name}
          disabled={readOnly}
          {...field((draft, value) => setEngagementName(draft, value), 'the name', 'eng-name')}
        />
        <div className="row gap-6">
          <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
            for
          </span>
          <input
            className="client-input"
            aria-label="Client"
            placeholder="Which client?"
            value={stressed.client}
            disabled={readOnly}
            {...field((draft, value) => setClient(draft, value), 'the client', 'eng-client')}
          />
        </div>
      </div>

      <div className="setup">
        <div className="field">
          <label htmlFor="eng-start">Starts</label>
          <input
            id="eng-start"
            type="date"
            value={stressed.startDate}
            disabled={readOnly}
            {...field((draft, value) => setStartDate(draft, value), 'the start date', 'start')}
          />
        </div>
        <div className="field narrow">
          <label htmlFor="eng-weeks">Weeks</label>
          <input
            id="eng-weeks"
            type="number"
            min={1}
            value={stressed.weeks}
            disabled={readOnly}
            {...field(
              (draft, value) => setWeeks(draft, Number.parseInt(value, 10) || 1),
              'the duration',
              'weeks',
            )}
          />
        </div>
        <div className="field narrow">
          <label htmlFor="eng-leave">Leave</label>
          <input
            id="eng-leave"
            type="number"
            min={0}
            max={60}
            title="Annual leave days per person-year"
            value={stressed.annualLeaveDays ?? 0}
            disabled={readOnly}
            {...field(
              (draft, value) => ({
                ...draft,
                annualLeaveDays: Math.max(0, Number.parseInt(value, 10) || 0),
              }),
              'the leave allowance',
              'leave',
            )}
          />
        </div>
        <button
          className="ghost tiny"
          aria-expanded={showSettings}
          onClick={() => setShowSettings(!showSettings)}
        >
          {showSettings ? 'Fewer settings' : 'More'}
        </button>
      </div>

      {showSettings && (
        <div className="setup more">
          <div className="field narrow">
            <label htmlFor="eng-sprint">Sprint</label>
            <input
              id="eng-sprint"
              type="number"
              min={1}
              max={12}
              value={stressed.sprintWeeks ?? 2}
              disabled={readOnly}
              {...field(
                (draft, value) => setSprintWeeks(draft, Number.parseInt(value, 10) || 1),
                'the sprint length',
                'sprint',
              )}
            />
          </div>
          <div className="field narrow">
            <label htmlFor="eng-terms">Terms</label>
            <input
              id="eng-terms"
              type="number"
              min={0}
              max={52}
              title="Weeks between billing and cash landing"
              value={stressed.paymentTermsWeeks ?? 0}
              disabled={readOnly}
              {...field(
                (draft, value) => setPaymentTerms(draft, Number.parseInt(value, 10) || 0),
                'the payment terms',
                'terms',
              )}
            />
          </div>
          <span className="tiny muted" style={{ maxWidth: 620 }}>
            One person full-time delivers <strong>{formatDays(basis.availableDays)} days</strong>{' '}
            over {basis.weeks} weeks — {formatDays(basis.workingDays, 0)} working, less{' '}
            {formatDays(basis.publicHolidayDays, 0)} holiday and{' '}
            {formatDays(basis.annualLeaveDays)} leave. Annualised that is{' '}
            {formatDays(basis.annualisedAvailableDays, 0)} days,{' '}
            {formatDays(basis.annualisedBeforeLeave, 0)} before leave. Sprint length is display
            only; payment terms drive cash exposure.
          </span>
        </div>
      )}
    </div>
  );
}
