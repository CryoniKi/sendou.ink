import { type ActionFunction, type LoaderArgs, json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { Label } from "~/components/Label";
import { Main } from "~/components/Main";
import { CALENDAR_EVENT_RESULT } from "~/constants";
import { db } from "~/db";
import { requireUser } from "~/modules/auth";
import { canReportCalendarEventWinners } from "~/permissions";
import {
  notFoundIfFalsy,
  safeParseRequestFormData,
  validate,
} from "~/utils/remix";
import { actualNumber, id, safeJSONParse, toArray } from "~/utils/zod";
import * as React from "react";
import type { User } from "~/db/types";
import { Button } from "~/components/Button";
import clsx from "clsx";
import { UserCombobox } from "~/components/Combobox";
import { FormMessage } from "~/components/FormMessage";
import { FormErrors } from "~/components/FormErrors";

const playersSchema = z
  .array(
    z.union([
      z.string().min(1).max(CALENDAR_EVENT_RESULT.MAX_PLAYER_NAME_LENGTH),
      z.object({ id }),
    ])
  )
  .nonempty({ message: "Each team must have at least one player." })
  .max(CALENDAR_EVENT_RESULT.MAX_PLAYERS_LENGTH)
  .refine(
    (val) => {
      const userIds = val.flatMap((user) =>
        typeof user === "string" ? [] : user.id
      );

      return userIds.length === new Set(userIds).size;
    },
    {
      message: "Can't have the same player twice in the same team.",
    }
  );

const reportWinnersActionSchema = z.object({
  participantsCount: z.preprocess(
    actualNumber,
    z
      .number()
      .int()
      .positive()
      .max(CALENDAR_EVENT_RESULT.MAX_PARTICIPANTS_COUNT)
  ),
  team: z.preprocess(
    toArray,
    z
      .array(
        z.preprocess(
          safeJSONParse,
          z.object({
            teamName: z
              .string()
              .min(1)
              .max(CALENDAR_EVENT_RESULT.MAX_TEAM_NAME_LENGTH),
            placement: z.preprocess(
              actualNumber,
              z
                .number()
                .int()
                .positive()
                .max(CALENDAR_EVENT_RESULT.MAX_TEAM_PLACEMENT)
            ),
            players: playersSchema,
          })
        )
      )
      .refine(
        (val) => val.length === new Set(val.map((team) => team.teamName)).size,
        { message: "Each team needs a unique name." }
      )
  ),
});

export const action: ActionFunction = async ({ request }) => {
  const data = await safeParseRequestFormData({
    request,
    schema: reportWinnersActionSchema,
  });

  if (!data.success) {
    return {
      errors: data.error.errors.map((error) => error.message),
    };
  }

  return null;
};

export const handle = {
  i18n: "calendar",
};

export const loader = async ({ request, params }: LoaderArgs) => {
  const parsedParams = z
    .object({ id: z.preprocess(actualNumber, id) })
    .parse(params);
  const user = await requireUser(request);
  const event = notFoundIfFalsy(db.calendarEvents.findById(parsedParams.id));

  validate(
    canReportCalendarEventWinners({
      user,
      event,
      startTimes: event.startTimes,
    }),
    401
  );

  return json({
    name: event.name,
  });
};

export default function ReportWinnersPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <Main halfWidth>
      <Form method="post" className="stack smedium items-start">
        <h1 className="text-lg">Reporting results of {data.name}</h1>
        <ParticipantsCountInput />
        <FormMessage type="info">
          You choose how many results to report. It can be just the winning
          team, top 3 or whatever you decide.
        </FormMessage>
        <TeamInputs />
        <Button type="submit" className="mt-4">
          Submit
        </Button>
        <FormErrors />
      </Form>
    </Main>
  );
}

function ParticipantsCountInput() {
  // const { eventToEdit } = useLoaderData<typeof loader>();

  return (
    <div>
      <Label htmlFor="name" required>
        Participants count
      </Label>
      <input
        name="participantsCount"
        type="number"
        required
        min={1}
        max={CALENDAR_EVENT_RESULT.MAX_PARTICIPANTS_COUNT}
        // defaultValue={eventToEdit?.name}
        data-cy="participants-count-input"
        className="w-24"
      />
    </div>
  );
}

function TeamInputs() {
  const [amountOfTeams, setAmountOfTeams] = React.useState(1);

  const handleTeamDelete = () => {
    setAmountOfTeams(amountOfTeams - 1);
  };

  return (
    <>
      <hr className="w-full" />
      {new Array(amountOfTeams + 1).fill(null).map((_, i) => {
        // last team is hidden so we can save its state even if user removes a filled team
        const hidden = i === amountOfTeams;

        return (
          <React.Fragment key={i}>
            <Team
              onRemoveTeam={
                i === amountOfTeams - 1 && amountOfTeams > 1
                  ? handleTeamDelete
                  : undefined
              }
              hidden={hidden}
              initialPlacement={String(i + 1)}
            />
            {!hidden && <hr className="w-full" />}
          </React.Fragment>
        );
      })}
      <Button
        onClick={() => setAmountOfTeams((amountOfTeams) => amountOfTeams + 1)}
        tiny
      >
        Add team
      </Button>
    </>
  );
}

const NEW_PLAYER = { id: 0 } as const;

interface TeamResults {
  teamName: string;
  placement: string;
  players: Array<
    | {
        id: User["id"];
      }
    | string
  >;
}

function Team({
  onRemoveTeam,
  hidden,
  initialPlacement,
}: {
  onRemoveTeam?: () => void;
  hidden: boolean;
  initialPlacement: string;
}) {
  const teamNameId = React.useId();
  const placementId = React.useId();

  const [results, setResults] = React.useState<TeamResults>({
    teamName: "",
    placement: initialPlacement,
    players: [NEW_PLAYER, NEW_PLAYER, NEW_PLAYER, NEW_PLAYER],
  });

  const handleTeamNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResults({ ...results, teamName: e.target.value });
  };

  const handlePlacementChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResults({ ...results, placement: e.target.value });
  };

  return (
    <div className={clsx("stack md items-start", { hidden })}>
      {!hidden && (
        <input
          type="hidden"
          name="team"
          value={JSON.stringify({
            ...results,
            players: results.players.filter(
              (player) =>
                (typeof player === "string" && player !== "") ||
                (typeof player === "object" && player.id !== 0)
            ),
          })}
        />
      )}
      <div className="stack horizontal md flex-wrap">
        <div>
          <Label htmlFor={teamNameId}>Team name</Label>
          <input
            id={teamNameId}
            value={results.teamName}
            onChange={handleTeamNameChange}
            // xxx: why doesn't work?
            minLength={1}
            maxLength={CALENDAR_EVENT_RESULT.MAX_TEAM_NAME_LENGTH}
          />
        </div>
        <div>
          <Label htmlFor={placementId}>Placement</Label>
          <input
            id={placementId}
            value={results.placement}
            type="number"
            onChange={handlePlacementChange}
            min={1}
            max={CALENDAR_EVENT_RESULT.MAX_TEAM_PLACEMENT}
            className="w-24"
          />
        </div>
      </div>
      <Players
        players={results.players}
        setPlayers={(players) => setResults({ ...results, players })}
      />
      {onRemoveTeam && (
        <Button
          onClick={onRemoveTeam}
          tiny
          variant="minimal-destructive"
          className="mt-4"
        >
          Remove team
        </Button>
      )}
    </div>
  );
}

function Players({
  players,
  setPlayers,
}: {
  players: TeamResults["players"];
  setPlayers: (newPlayers: TeamResults["players"]) => void;
}) {
  const handleAddPlayer = () => {
    setPlayers([...players, NEW_PLAYER]);
  };

  const handleRemovePlayer = () => {
    setPlayers(players.slice(0, -1));
  };

  const handlePlayerInputTypeChange = (index: number) => {
    const newPlayers = [...players];
    newPlayers[index] = typeof newPlayers[index] === "string" ? NEW_PLAYER : "";
    setPlayers(newPlayers);
  };

  const handleInputChange = (index: number, newValue: string | number) => {
    const newPlayers = [...players];
    newPlayers[index] =
      typeof newValue === "string" ? newValue : { id: newValue };
    setPlayers(newPlayers);
  };

  return (
    <div className="stack md">
      {players.map((player, i) => {
        const formId = `player-${i + 1}`;
        const asPlainInput = typeof player === "string";

        return (
          <div key={i}>
            <div className="stack horizontal md items-center mb-1">
              <label htmlFor={formId} className="mb-0">
                Player {i + 1}
              </label>
              <Button
                tiny
                variant="minimal"
                onClick={() => handlePlayerInputTypeChange(i)}
              >
                {asPlainInput ? "Add as user (recommended)" : "Add as text"}
              </Button>
            </div>
            {asPlainInput ? (
              <input
                id={formId}
                onChange={(e) => handleInputChange(i, e.target.value)}
                min={1}
                max={CALENDAR_EVENT_RESULT.MAX_PLAYER_NAME_LENGTH}
              />
            ) : (
              <UserCombobox
                id={formId}
                inputName="old-user"
                onChange={(selected) =>
                  handleInputChange(
                    i,
                    selected?.value ? Number(selected?.value) : NEW_PLAYER.id
                  )
                }
              />
            )}
          </div>
        );
      })}
      <div className="stack horizontal sm mt-2">
        <Button
          tiny
          onClick={handleAddPlayer}
          disabled={players.length === CALENDAR_EVENT_RESULT.MAX_PLAYERS_LENGTH}
          variant="outlined"
        >
          Add player
        </Button>{" "}
        <Button
          tiny
          variant="destructive"
          onClick={handleRemovePlayer}
          disabled={players.length === 1}
        >
          Remove player
        </Button>
      </div>
    </div>
  );
}
